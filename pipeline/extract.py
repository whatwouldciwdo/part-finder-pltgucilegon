"""OCR halaman katalog dengan model vision -> JSON.
Penyedia dipilih lewat .env: PROVIDER=openai (OpenAI-compatible) atau gemini.
Pemakaian: python pipeline/extract.py 5 6 7   (nomor halaman PDF, 1-based)
           tambahkan --force untuk menimpa hasil yang sudah ada
Hasil: data/ocr/pNNN.json
"""
import base64, io, json, os, re, subprocess, sys, time
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

PROVIDER = os.environ.get("PROVIDER", "gemini").lower()

PROMPT = """Ini satu halaman dari katalog suku cadang gas turbine (hasil scan).
Kembalikan HANYA JSON (tanpa teks lain, tanpa markdown) dengan skema:
{
 "page_type": "parts_list" | "diagram" | "toc" | "other",
 "page_code": kode di pojok halaman, mis. "1-1" atau "2-2" (null jika tidak ada),
 "title": judul assembly di bawah judul halaman, mis. "SPINDLE BOLT ASS'Y (COMP SIDE)" (null jika tidak ada),
 "parts": [ {"key_no": int, "part_name": str, "assy_dwg_no": str|null, "dwg_no": str|null, "qty": str|null, "remarks": str|null} ]
}
Aturan:
- "parts" hanya diisi untuk page_type "parts_list"; selain itu array kosong.
- Salin teks PERSIS seperti tercetak (huruf besar, tanda hubung, spasi). Jangan memperbaiki atau menebak.
- Kolom: KEY NO., PART NAME, ASS'Y DWG. NO. & MARK, DWG. NO. & MARK, Q'TY, REMARKS.
- Lewati baris kosong. Jika sel kosong gunakan null.
- Kode drawing berbentuk seperti G1-A0435-18, 09-07503-30, G2-09956-01: perhatikan angka 0 vs huruf O dan 1 vs I.
"""

RETRY_WORDS = ("503", "502", "504", "429", "500", "getaddrinfo", "ConnectError",
               "Timeout", "timed out", "disconnected", "Connection error", "overloaded")


def parse_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    return json.loads(text)


def make_caller():
    if PROVIDER == "openai":
        from openai import OpenAI
        client = OpenAI(base_url=os.environ.get("OPENAI_BASE_URL") or None,
                        api_key=os.environ["OPENAI_API_KEY"], timeout=300)
        model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

        def call(img):
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=85)
            url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
            msgs = [{"role": "user", "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": url}}]}]
            try:
                r = client.chat.completions.create(
                    model=model, messages=msgs, temperature=0,
                    response_format={"type": "json_object"})
            except Exception as e:
                if "response_format" not in str(e):
                    raise
                r = client.chat.completions.create(model=model, messages=msgs, temperature=0)
            return r.choices[0].message.content
        return call

    from google import genai
    from google.genai import types
    key = os.environ.get("GEMINI_API_KEY")
    if not key and os.name == "nt":
        r = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')"],
                           capture_output=True, text=True)
        key = r.stdout.strip() or None
    if not key:
        sys.exit("GEMINI_API_KEY tidak ditemukan")
    client = genai.Client(api_key=key)
    model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

    def call(img):
        r = client.models.generate_content(
            model=model, contents=[img, PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type="application/json", temperature=0))
        return r.text
    return call


def main():
    call = make_caller()
    out = ROOT / "data" / "ocr"
    out.mkdir(parents=True, exist_ok=True)
    for n in [int(a) for a in sys.argv[1:] if a.isdigit()]:
        dest = out / f"p{n:03d}.json"
        if dest.exists() and "--force" not in sys.argv:
            continue
        img = Image.open(ROOT / "data" / "pages" / f"p{n:03d}.webp").convert("RGB")
        for attempt in range(6):
            try:
                data = parse_json(call(img))
                break
            except Exception as e:
                retry = any(w in str(e) for w in RETRY_WORDS) or isinstance(e, json.JSONDecodeError)
                if attempt == 5 or not retry:
                    raise
                time.sleep(10 * 2 ** min(attempt, 3))
        data["pdf_page"] = n
        dest.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(n, data.get("page_type"), data.get("page_code"), len(data.get("parts", [])), flush=True)


if __name__ == "__main__":
    main()

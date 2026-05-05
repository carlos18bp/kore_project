import requests, csv, time, os

FIELDS = "product_name,product_name_es,energy-kcal_100g,proteins_100g,carbohydrates_100g,fat_100g,fiber_100g,nova_group,nutrition_grades,food_groups_tags"
HEADERS = {"User-Agent": "KoreHealthApp/1.0 (contact@korehealths.com)"}
PAGE_SIZE = 100
OUTPUT = "off_colombia.csv"
CHECKPOINT = "off_colombia_checkpoint.txt"


def fetch_page(page, retries=5):
    url = (
        f"https://world.openfoodfacts.org/api/v2/search"
        f"?countries_tags_en=colombia&fields={FIELDS}"
        f"&page_size={PAGE_SIZE}&page={page}&json=1"
    )
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200 and resp.text.strip():
                return resp.json()
        except Exception:
            pass
        wait = 2 ** attempt
        print(f"    Reintento {attempt+1} en {wait}s...", flush=True)
        time.sleep(wait)
    return None


# Resume from checkpoint if exists
start_page = 1
rows = []
if os.path.exists(CHECKPOINT):
    with open(CHECKPOINT) as f:
        start_page = int(f.read().strip()) + 1
    if os.path.exists(OUTPUT):
        with open(OUTPUT, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    print(f"Retomando desde página {start_page}, {len(rows)} filas ya guardadas", flush=True)

fieldnames = FIELDS.split(",")
page = start_page

while True:
    data = fetch_page(page)
    if data is None:
        print(f"Error persistente en página {page}, abortando.", flush=True)
        break

    products = data.get("products", [])
    if not products:
        print("No hay más productos.", flush=True)
        break

    if page == start_page:
        total = data.get("count", 0)
        print(f"Total productos: {total}", flush=True)

    rows.extend(products)
    print(f"  Página {page}: {len(rows)} filas acumuladas", flush=True)

    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    with open(CHECKPOINT, "w") as f:
        f.write(str(page))

    page += 1
    time.sleep(3.0)

print(f"\nFinalizado: {OUTPUT} ({len(rows)} filas)")
if os.path.exists(CHECKPOINT):
    os.remove(CHECKPOINT)

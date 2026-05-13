"""
Traduce taco_alimentos.csv (PT) → taco_alimentos_es.csv (ES).
Aplica un diccionario de términos PT→ES sobre el nombre y la categoría.
"""
import csv, re

# ── Diccionario PT → ES ──────────────────────────────────────────────────────
# Orden importa: términos más específicos primero para evitar solapamientos.
PT_ES = {
    # Categorías
    "Cereais e derivados": "Cereales y derivados",
    "Carnes e derivados": "Carnes y derivados",
    "Frutas e derivados": "Frutas y derivados",
    "Verduras, hortaliças e derivados": "Verduras, hortalizas y derivados",
    "Leguminosas e derivados": "Legumbres y derivados",
    "Pescados e frutos do mar": "Pescados y mariscos",
    "Leite e derivados": "Lácteos y derivados",
    "Gorduras e óleos": "Grasas y aceites",
    "Bebidas (alcoólicas e não alcoólicas)": "Bebidas (alcohólicas y no alcohólicas)",
    "Alimentos preparados": "Alimentos preparados",
    "Produtos açucarados": "Productos azucarados",
    "Nozes e sementes": "Nueces y semillas",
    "Ovos e derivados": "Huevos y derivados",
    "Miscelâneas": "Misceláneos",
    "Outros alimentos industrializados": "Otros alimentos industrializados",

    # Frutas
    "Abacate": "Aguacate",
    "Abacaxi": "Piña",
    "Abiu": "Caimito",
    "Acerola": "Acerola",
    "Açaí": "Açaí",
    "Ameixa": "Ciruela",
    "Atemóia": "Anona",
    "Banana": "Banano",
    "Caju": "Marañón",
    "Caqui": "Caqui",
    "Carambola": "Carambola",
    "Figo": "Higo",
    "Framboesa": "Frambuesa",
    "Goiaba": "Guayaba",
    "Graviola": "Guanábana",
    "Jaca": "Yaca",
    "Jabuticaba": "Jabuticaba",
    "Laranja": "Naranja",
    "Limão": "Limón",
    "Maçã": "Manzana",
    "Mamão": "Papaya",
    "Manga": "Mango",
    "Maracujá": "Maracuyá",
    "Melão": "Melón",
    "Melancia": "Sandía",
    "Morango": "Fresa",
    "Pêssego": "Durazno",
    "Pêra": "Pera",
    "Pitanga": "Pitanga",
    "Romã": "Granada",
    "Sapoti": "Mamey sapote",
    "Tamarindo": "Tamarindo",
    "Tangerina": "Mandarina",
    "Uva": "Uva",

    # Verduras / hortalizas
    "Abóbora": "Calabaza",
    "Abobrinha": "Zucchini",
    "Acelga": "Acelga",
    "Agrião": "Berro",
    "Aipim": "Yuca",
    "Aipo": "Apio",
    "Alface": "Lechuga",
    "Alfavaca": "Albahaca",
    "Alho-poró": "Puerro",
    "Alho": "Ajo",
    "Almeirão": "Achicoria",
    "Batata-doce": "Camote",
    "Batata": "Papa",
    "Berinjela": "Berenjena",
    "Beterraba": "Remolacha",
    "Brócolis": "Brócoli",
    "Cebola": "Cebolla",
    "Cenoura": "Zanahoria",
    "Chicória": "Endibia",
    "Chuchu": "Chayote",
    "Couve-flor": "Coliflor",
    "Couve": "Col",
    "Espinafre": "Espinaca",
    "Inhame": "Ñame",
    "Jiló": "Berenjena amarga",
    "Mandioca": "Yuca/mandioca",
    "Milho-verde": "Maíz tierno",
    "Milho": "Maíz",
    "Pepino": "Pepino",
    "Pimentão": "Pimiento",
    "Quiabo": "Okra",
    "Rabanete": "Rábano",
    "Repolho": "Repollo",
    "Tomate": "Tomate",
    "Vagem": "Vainita",

    # Cereales / granos
    "Arroz": "Arroz",
    "Aveia": "Avena",
    "Cevada": "Cebada",
    "Farinha": "Harina",
    "Fubá": "Harina de maíz",
    "Macarrão": "Pasta/fideo",
    "Pão": "Pan",
    "Tapioca": "Tapioca",
    "Trigo": "Trigo",

    # Legumbres
    "Amendoim": "Maní",
    "Ervilha": "Arveja",
    "Feijão": "Frijol",
    "Grão-de-bico": "Garbanzo",
    "Lentilha": "Lenteja",
    "Soja": "Soya",

    # Carnes
    "Bife": "Bistec",
    "Bisteca": "Chuleta",
    "Cabrito": "Cabrito",
    "Carne": "Carne",
    "Coelho": "Conejo",
    "Cordeiro": "Cordero",
    "Costela": "Costilla",
    "Costeleta": "Costilla",
    "Frango": "Pollo",
    "Lombo": "Lomo",
    "Pato": "Pato",
    "Pernil": "Pierna",
    "Peru": "Pavo",
    "Porco": "Cerdo",
    "Vitela": "Ternera",

    # Cortes de res
    "Acém": "Aguja de res",
    "Alcatra": "Lomo de res",
    "Contrafilé": "Lomo fino",
    "Filé mignon": "Filete mignon",
    "Patinho": "Cuadril",
    "Picanha": "Picanha",
    "Músculo": "Osobuco",
    "Lagarto": "Cadera de res",

    # Partes de pollo
    "Asa": "Ala",
    "Coxa": "Muslo",
    "Peito": "Pechuga",
    "Sobrecoxa": "Contramuslo",

    # Pescados
    "Abadejo": "Abadejo",
    "Anchova": "Anchoa",
    "Atum": "Atún",
    "Bacalhau": "Bacalao",
    "Camarão": "Camarón",
    "Carpa": "Carpa",
    "Corvina": "Corvina",
    "Dourado": "Dorado",
    "Lagosta": "Langosta",
    "Linguado": "Lenguado",
    "Merluza": "Merluza",
    "Peixe": "Pescado",
    "Salmão": "Salmón",
    "Sardinha": "Sardina",
    "Tilápia": "Tilapia",
    "Truta": "Trucha",

    # Lácteos
    "Iogurte": "Yogur",
    "Leite": "Leche",
    "Manteiga": "Mantequilla",
    "Queijo": "Queso",
    "Requeijão": "Requesón",
    "Creme de leite": "Crema de leche",
    "Creme": "Crema",

    # Aceites / grasas
    "Azeite de oliva": "Aceite de oliva",
    "Azeite": "Aceite de oliva",
    "Óleo de coco": "Aceite de coco",
    "Óleo de soja": "Aceite de soya",
    "Óleo": "Aceite vegetal",
    "Margarina": "Margarina",
    "Banha": "Manteca de cerdo",

    # Huevos
    "Ovo": "Huevo",
    "Ovos": "Huevos",

    # Bebidas
    "Água": "Agua",
    "Cachaça": "Aguardiente de caña",
    "Café": "Café",
    "Cerveja": "Cerveza",
    "Suco": "Jugo",
    "Vinho": "Vino",
    "Achocolatado": "Chocolatada",

    # Métodos de preparación
    ", cru": ", crudo",
    ", crua": ", cruda",
    ", cozido": ", cocido",
    ", cozida": ", cocida",
    ", assado": ", asado",
    ", assada": ", asada",
    ", frito": ", frito",
    ", frita": ", frita",
    ", grelhado": ", a la plancha",
    ", grelhada": ", a la plancha",
    " grelhado": " a la plancha",
    " grelhada": " a la plancha",
    ", refogado": ", salteado",
    ", refogada": ", salteada",
    ", defumado": ", ahumado",
    ", defumada": ", ahumada",
    ", congelado": ", congelado",
    ", congelada": ", congelada",
    ", desidratado": ", deshidratado",
    ", desidratada": ", deshidratada",
    ", recheado": ", relleno",
    ", recheada": ", rellena",
    ", integral": ", integral",
    ", enlatado": ", enlatado",
    ", enlatada": ", enlatada",
    ", em calda": ", en almíbar",
    ", em conserva": ", en conserva",
    ", em pó": ", en polvo",
    ", fresco": ", fresco",
    ", fresca": ", fresca",
    ", light": ", light",
    ", diet": ", diet",
    ", magro": ", magro",
    ", sem pele": ", sin piel",
    ", sem osso": ", sin hueso",
    ", com osso": ", con hueso",
    ", com pele": ", con piel",
    ", filé": ", filete",
    ", inteiro": ", entero",
    ", inteira": ", entera",
    ", moído": ", molido",
    ", moída": ", molida",
    ", fatiado": ", en rebanadas",
    ", fatiada": ", en rebanadas",
    ", em cubo": ", en cubos",
    ", picado": ", picado",
    ", picada": ", picada",
    ", ralado": ", rallado",
    ", ralada": ", rallada",
    ", batido": ", batido",
    ", drenado": ", escurrido",
    ", drenada": ", escurrida",
    ", polpa": ", pulpa",
    ", suco": ", jugo",
    ", gema": ", yema",
    ", clara": ", clara",
    ", tipo": ", tipo",
    ", pó": ", polvo",
    " tipo ": " tipo ",

    # Palabras gramaticales y partículas PT
    " com ": " con ",
    " sem ": " sin ",
    " em ": " en ",
    " de ": " de ",
    " do ": " del ",
    " da ": " de la ",
    " dos ": " de los ",
    " das ": " de las ",
    " ao ": " al ",
    " às ": " a las ",
    " ou ": " o ",
    " pó": " polvo",
    " torrado": " tostado",
    " torrada": " tostada",
    " salgado": " salado",
    " salgada": " salada",
    "virgem": "virgen",
    "extra virgem": "extra virgen",
    " flocos": " hojuelas",
    " grão": " grano",
    " em calda": " en almíbar",
    " em conserva": " en conserva",
    " em Vainita": " en vainita",
    "galinha": "gallina",
    "castanha": "castaña",
    "Castanha-do-Brasil": "Nuez de Brasil",
    "Castanha-de-Marañón": "Castaña de marañón",
    "açúcar": "azúcar",
    "Açúcar": "Azúcar",
    "azeitona": "aceituna",
    "Azeitona": "Aceituna",
    "fermento": "levadura",
    "Fermento": "Levadura",
    "biscoito": "galleta",
    "Biscoito": "Galleta",
    "xarope": "jarabe",
    "glucose": "glucosa",
    "guaraná": "guaraná",
    "dendê": "palma",
    "centeio": "centeno",
    "rosca": "roscas",
    "puba": "fermentada",
    "fécula": "fécula",
    "Fécula": "Fécula",
    "palmito": "palmito",
    "Palmito": "Palmito",
    "manjericão": "albahaca",
    "Manjericão": "Albahaca",
    "seleta de legumes": "mezcla de vegetales",
    "Seleta de legumes": "Mezcla de vegetales",
    "semente": "semilla",
    "pescoço": "cuello",
    "Pescoço": "Cuello",
    "canjica": "maíz pelado",
    "Canjica": "Maíz pelado",
    "cupuaçu": "cupuazú",
    "Cupuaçu": "Cupuazú",
    "cereal matinal": "cereal de desayuno",
    "Cereal matinal": "Cereal de desayuno",
    "pipoca": "palomitas de maíz",
    "Pipoca": "Palomitas de maíz",
    "pastel": "empanada",
    "Pastel": "Empanada",
    "doce em barra": "dulce en barra",
    "doce em calda": "en almíbar",
    "láctea": "láctea",

    # Misc comunes
    "Feijão-caupi": "Frijol caupí",
    "Feijão-preto": "Frijol negro",
    "Feijão-carioca": "Frijol carioca",
    "Banana-prata": "Banano prata",
    "Banana-nanica": "Banano nanica",
    "Banana-da-terra": "Plátano",
}

# ── Función de traducción ─────────────────────────────────────────────────────
def translate(text: str) -> str:
    result = text
    for pt, es in PT_ES.items():
        if result == pt:
            return es
        escaped = re.escape(pt)
        # Si el término empieza/termina con caracter no-palabra, usar string replace simple
        starts_word = bool(re.match(r'\w', pt))
        ends_word = bool(re.search(r'\w$', pt))
        prefix = r'\b' if starts_word else ''
        suffix = r'\b' if ends_word else ''
        result = re.sub(r'(?i)' + prefix + escaped + suffix, es, result)
    return result


# ── Procesar CSV ──────────────────────────────────────────────────────────────
INPUT = "taco_alimentos.csv"
OUTPUT = "taco_alimentos_es.csv"

with open(INPUT, encoding="utf-8") as fin, \
     open(OUTPUT, "w", newline="", encoding="utf-8") as fout:

    reader = csv.reader(fin, delimiter=";")
    writer = csv.writer(fout)

    header = next(reader)
    # Traducir encabezados clave
    new_header = [
        "id", "categoria", "nombre",
        "humedad_pct", "calorias_kcal", "energia_kj",
        "proteinas_g", "grasas_g", "colesterol_mg",
        "carbohidratos_g", "fibra_g", "cenizas_g",
        "calcio_mg", "magnesio_mg", "manganeso_mg", "fosforo_mg",
        "hierro_mg", "sodio_mg", "potasio_mg", "cobre_mg", "zinc_mg",
        "retinol_mcg", "re_mcg", "rae_mcg",
        "tiamina_mg", "riboflavina_mg", "piridoxina_mg", "niacina_mg", "vitamina_c_mg",
    ]
    writer.writerow(new_header)

    count = 0
    for row in reader:
        if len(row) < 3:
            continue
        row[1] = translate(row[1])  # categoría
        row[2] = translate(row[2])  # nombre del alimento
        writer.writerow(row)
        count += 1

print(f"Traducidos: {count} alimentos → {OUTPUT}")

# Evidenca delovnih ur – aplikacija za zaposlene

Spletna aplikacija za beleženje delovnih ur, dopusta in bolniške po dnevih.
Zaposlena se prijavi z geslom, ki ji ga dodeli administrator, in za vsak dan
odda, koliko ur je delala oziroma ali je bila na dopustu/bolniški. Administrator
vidi vse in lahko za posamezno zaposleno natisne celoten mesec po dnevih.

Tehnologija: Next.js 14 (App Router) + Upstash Redis (REST) na Vercelu.
Ista postavitev kot pri aplikaciji `delovne-ure-caks`.

---

## Kaj aplikacija zna

**Zaposlena**

- Prijava: izbere svoje ime + vpiše geslo (geslo dodeli administrator).
- Mesečni koledar; klik na dan odpre vnos.
- Za vsak dan: **Delo** (število ur), **Dopust**, **Bolniška**, **Prost dan** + neobvezna **opomba**.
- Gumb *Napovej dopust / bolniško vnaprej* – vpiše obdobje od–do, tudi za prihodnje mesece.
- Sproten povzetek meseca: ure dela, dnevi dopusta, dnevi bolniške, skupaj ur.
- Prazniki so v koledarju označeni z vijolično piko (avtomatsko, vključno z veliko nočjo).

**Skupni koledar razpoložljivosti** (zavihek *Kdaj ne morem*)

- Vidijo ga **vse zaposlene in vodja**. Vsaka ima svojo barvo.
- Vsaka klikne na dan in označi **Cel dan / Dopoldne / Popoldne ne morem**.
  Razlog se nikjer ne piše in ne prikaže.
- Napovedan dopust ali bolniška iz evidence se samodejno šteje kot
  "cel dan ne more" – brez podvajanja vnosa in brez razkritja vrste odsotnosti.
- Klik na dan pokaže tudi **seznam, kdo lahko dela** za vsako od štirih smen.

**Tedenski urnik** (zavihek *Urnik*)

- Štiri smene na dan: dve dopoldan, dve popoldan. Privzeto
  **Odpiranje 6–13, Dopoldan 7–14, Popoldan 14–21, Zapiranje 15–22** –
  ure se spremenijo v *Nastavitvah*.
- Vodja za vsako polje izbere osebo. V spustnem seznamu so ločeno
  *Na voljo* in *Ne more ta dan* (če vseeno izbereš tako, se polje obarva rdeče).
- Gumb **Predlagaj urnik**: najprej razporedi **zaposlene do polne tedenske norme**,
  študentke pa zapolnijo preostale smene. Nihče ni dvakrat na isti dan, sedmi
  zaporedni delovni dan se izogiba. Predlog nato ročno popraviš.
- Sproti šteje **ure na teden po osebi** in opozori, če je zaposlena pod normo
  (rdeče) ali čez njo (oranžno).
- **Objavi urnik** – dokler teden ni objavljen, ga zaposlene ne vidijo.
- **Natisni** – tedenska tabela za na vrata.
- Zaposlena vidi *Moje smene ta teden* in z gumbom **Dodaj v koledar (.ics)**
  prenese svoje smene v telefonski koledar (Google/Apple).

**Administrator**

- *Evidenca / izpis* – izbere mesec, obkljuka eno ali več zaposlenih in dobi za vsako
  izpis po dnevih (datum, dan, ure dela, ure dopusta, ure bolniške, prosto, opomba/praznik)
  s seštevki in prostorom za podpis. Gumb **Natisni / shrani PDF** (v oknu za tiskanje
  izberi *Shrani kot PDF*).
- *Zaključi mesec* – zaklene mesec posamezne zaposlene, da ga ne more več spreminjati;
  administrator ga lahko kadarkoli odklene ali popravi.
- *Pregled meseca* – tabela vse ekipe: vrstica = zaposlena, stolpec = dan v mesecu.
- *Napovedani dopusti* – seznam vseh napovedanih odsotnosti za naslednje 4 mesece,
  urejen po datumu (za planiranje razporeda).
- *Zaposleni* – dodajanje, **zaposlena / študentka**, barva v koledarju, novo geslo,
  deaktivacija, brisanje.
- *Nastavitve* – ime lokala, dnevna norma ur (za obračun dopusta in bolniške),
  **tedenska norma** zaposlene, **ure vseh štirih smen** in menjava
  administratorskega gesla.

---

## Namestitev po korakih

### 1. Nova baza v Upstashu

1. Odpri [console.upstash.com](https://console.upstash.com) → **Create Database**.
2. Ime npr. `lokal-ure`, regija **eu-central-1** (Frankfurt).
3. Ko je baza narejena, odpri zavihek **REST API** in si shrani:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Nov repozitorij na GitHubu

1. [github.com/new](https://github.com/new) → ime npr. `lokal-ure`, **Private**, brez README.
2. Na strani repozitorija klikni **uploading an existing file**.
3. Odpakiraj `lokal-ure.zip` in **povleci vso vsebino mape** (mape `app`, `components`,
   `lib` in datoteke `package.json`, `next.config.mjs`, `jsconfig.json`, `.gitignore`,
   `README.md`) v okno za nalaganje.
   > Mape `node_modules` in `.next` ni treba nalagati – Vercel ju naredi sam.
4. **Commit changes**.

### 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** izbranega repozitorija.
2. Framework se sam prepozna kot **Next.js** – ničesar ne spreminjaj.
3. Odpri **Environment Variables** in dodaj tri spremenljivke:

   | Ime | Vrednost |
   |---|---|
   | `KV_REST_API_URL` | URL iz Upstasha (`https://....upstash.io`) |
   | `KV_REST_API_TOKEN` | token iz Upstasha |
   | `ADMIN_PASSWORD` | začetno geslo administratorja, npr. `1991` |

4. **Deploy**. Čez minuto dobiš naslov tipa `lokal-ure.vercel.app`.

> Če spremenljivke dodaš šele po prvem deployu, moraš v zavihku **Deployments**
> pognati **Redeploy**, da jih aplikacija dobi.

### 4. Prva uporaba

1. Odpri naslov aplikacije → zavihek **Administrator** → geslo iz `ADMIN_PASSWORD`.
2. **Nastavitve**: vpiši ime lokala in dnevno normo ur, po želji spremeni administratorsko geslo.
3. **Zaposleni**: dodaj vsako zaposleno (ime + geslo) in ji geslo sporoči.
4. Zaposlena odpre isti naslov, izbere svoje ime in vpiše geslo.

### 5. Bližnjica na telefonu

Naj vsaka zaposlena odpre naslov v telefonu in izbere *Dodaj na začetni zaslon*
(iPhone: Deli → Dodaj na začetni zaslon; Android: meni ⋮ → Dodaj na začetni zaslon).
Aplikacija se potem obnaša kot ikona na telefonu.

---

## Kako so shranjeni podatki

| Ključ v Redisu | Vsebina |
|---|---|
| `lokal:config` | ime lokala, dnevna norma, administratorsko geslo |
| `lokal:employees` | seznam zaposlenih (ime, geslo, aktivna) |
| `lokal:entries:<idZaposlene>:<YYYY-MM>` | vnosi enega meseca ene zaposlene + zaklep |
| `lokal:nemorem:<idZaposlene>:<YYYY-MM>` | dnevi, ko ne more delati (`ves`/`dop`/`pop`) |
| `lokal:urnik:<YYYY-MM>` | urnik meseca po dnevih in smenah + objavljeni tedni |

Vsaka zaposlena ima svoj ključ za vsak mesec, zato se vnosi različnih zaposlenih ne
morejo povoziti, tudi če vpisujejo hkrati.

Format vnosa za en dan:

```json
{ "t": "delo", "h": 8, "n": "jutranja izmena", "u": "2026-09-01T06:12:00.000Z" }
```

`t` = tip (`delo`, `dopust`, `bolniska`, `prosto`), `h` = ure, `n` = opomba,
`u` = čas zadnje spremembe.

---

## Varnost – pošteno povedano

Gesla so v bazi shranjena v čistopisu, prijava pa je preprosta (brez tokenov in
brez dvofaktorske avtentikacije). Za interno evidenco ur v lokalu je to povsem
uporabno, ni pa primerno za občutljive osebne podatke.

Kar aplikacija **preverja na strežniku** (in ne le v brskalniku):

- zaposlena lahko bere in piše **samo svoje** vnose;
- zaklenjenega meseca zaposlena ne more spreminjati;
- seznam gesel ni nikoli poslan na prijavni zaslon – vidi ga samo administrator.

Priporočila: vsaki zaposleni daj svoje geslo (ne skupnega), administratorsko
geslo takoj spremeni iz začetnega in ga ne deli, repozitorij na GitHubu naj
ostane **Private**.

---

## Lokalni zagon (neobvezno)

```bash
npm install
cp .env.example .env.local   # vpiši svoje Upstash podatke
npm run dev                  # http://localhost:3000
```

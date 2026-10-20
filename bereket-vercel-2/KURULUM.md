# Bereket — Kurulum Rehberi (Supabase + Vercel + Claude API)

Toplam süre: yaklaşık 30–40 dakika. Sırayla ilerleyin; her adımda kopyalayacağınız bir değer var, bunları bir not dosyasında toplayın.

| Değer | Nereden | Vercel'deki adı |
|---|---|---|
| Proje adresi | Supabase | `SUPABASE_URL` |
| Gizli anahtar | Supabase | `SUPABASE_SECRET_KEY` |
| Oturum anahtarı | Siz üretirsiniz | `SESSION_SECRET` |
| Claude API anahtarı | Anthropic | `ANTHROPIC_API_KEY` |

---

## Adım 1 — Supabase (veritabanı)

1. https://supabase.com adresine girip ücretsiz hesap açın.
2. **New project** → bir ad verin (örn. `bereket`), bir veritabanı şifresi belirleyin (bir yere not edin), **Region** olarak Avrupa'da bir bölge seçin (örn. Frankfurt) → **Create new project**. Hazırlanması 1–2 dakika sürer.
3. Sol menüden **SQL Editor** → **New query**. Bu klasördeki `supabase/schema.sql` dosyasını açın, tamamını kopyalayıp yapıştırın → **Run**. "Success" görmelisiniz.
4. Sol menüden **Table Editor**'a bakın: `accounts` ve `app_data` adlı iki tablo görünmeli.
5. **Project Settings → API Keys** sayfasına gidin:
   - **Secret keys** bölümündeki anahtarı kopyalayın (`sb_secret_...` ile başlar; yoksa **Create new secret key**). → `SUPABASE_SECRET_KEY`
   - Eski projelerde bunun yerine `service_role` anahtarı olabilir; o da çalışır.
6. Proje adresini kopyalayın: sayfanın üstündeki **Connect** düğmesinde ya da **Project Settings → Data API** sayfasında yazar (`https://xxxx.supabase.co`). → `SUPABASE_URL`

> Gizli anahtar veritabanına tam erişim verir. Kimseyle paylaşmayın, GitHub'a yüklemeyin; yalnızca Vercel ayarlarına yapıştıracaksınız.

## Adım 2 — Claude API (fotoğraf analizi)

1. https://console.anthropic.com adresine girip hesap açın.
2. **Billing** bölümünden kredi yükleyin (fotoğraf başına maliyet küçüktür; sunum için az bir tutar yeterli).
3. **Limits** bölümünden aylık **harcama limiti** koyun. Uygulamaya kayıt olan herkes fotoğraf analizi yapabildiği için bu önemli.
4. **API Keys → Create Key** → anahtarı kopyalayın (`sk-ant-...`). → `ANTHROPIC_API_KEY`

## Adım 3 — Oturum anahtarı

Girişleri imzalamak için en az 32 karakterlik rastgele bir metin gerekiyor. Bir şifre üreticiyle (örn. tarayıcınızın "güçlü şifre öner" özelliği) 40 karakterlik bir şifre üretin ve kopyalayın. → `SESSION_SECRET`

Bu değeri sonradan değiştirirseniz herkesin oturumu kapanır, veriler silinmez.

## Adım 4 — GitHub (kodu yüklemek)

1. https://github.com adresinde hesap açın (varsa giriş yapın).
2. Sağ üstte **+ → New repository** → ad: `bereket` → **Private** seçin → **Create repository**.
3. Açılan sayfada **uploading an existing file** bağlantısına tıklayın.
4. Bu ZIP'ten çıkardığınız klasörün **içindekileri** (index.html, api, lib, supabase klasörleri ve diğer dosyalar) sürükleyip bırakın. Klasörlerin de yüklendiğinden emin olun.
5. Alttaki **Commit changes** düğmesine basın.

Depoda şu yapı görünmeli:

```
index.html
vercel.json
package.json
api/   (ai.js, auth.js, collect.js, data.js, demo.js)
lib/   (db.js, util.js)
supabase/schema.sql
```

## Adım 5 — Vercel (yayınlamak)

1. https://vercel.com adresine **Continue with GitHub** ile girin.
2. **Add New… → Project** → listeden `bereket` deposunu bulun → **Import**.
3. **Framework Preset:** `Other`. Build ayarlarına dokunmayın.
4. **Environment Variables** bölümünü açın ve dört değeri tek tek ekleyin (ad solda, değer sağda):
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `SESSION_SECRET`
   - `ANTHROPIC_API_KEY`
5. **Deploy**. Bir dakika içinde size `https://bereket-xxxx.vercel.app` gibi bir link verilir.

## Adım 6 — Deneme

1. Linki telefonda açın → **Restoran girişi** → **Örnek restoran hesabıyla dene**.
2. **Ekle** sekmesinde **Fotoğraf çek** → bir atık fotoğrafı → **Fotoğrafı analiz et**. Karbon ve mali kayıp görünmeli.
3. Başka bir cihazda (ya da gizli pencerede) **Belediye girişi → Örnek belediye hesabıyla dene**. Restoranın kaydı **Bugün** rotasında görünmeli; **Toplandı** deyince restoranın **Taşıma** ekranı güncellenir (30 saniye içinde ya da sayfa yenilenince).

Örnek hesapların şifresi `bereket`. Örnek veriler her gün otomatik tazelenir; örnek hesaplara eklenen kayıtlar ertesi gün sıfırlanır. Gerçek kullanım için **Hesap oluştur** ile kendi hesaplarınızı açın.

---

## Sorun giderme

| Ekranda / durumda | Sebep ve çözüm |
|---|---|
| "Sunucu ayarları eksik" | Vercel'de bir ortam değişkeni eksik ya da yanlış adla girilmiş. Ekledikten sonra **Deployments → en üstteki → ⋯ → Redeploy** yapın; değişkenler ancak yeniden yayınlamada devreye girer. |
| "Yapay zekâ şu an kullanılamıyor" | `ANTHROPIC_API_KEY` eksik. Ekleyip **Redeploy** yapın. |
| Analiz hata veriyor | Anthropic hesabında kredi bitmiş ya da limit dolmuş olabilir. Vercel → Project → **Logs** bölümünde ayrıntı görünür. |
| Giriş yapılamıyor, "Bir sorun oluştu" | Supabase'de `schema.sql` çalıştırılmamış ya da anahtar yanlış. Vercel **Logs**'ta `db 401` / `db 404` görürsünüz. |

## Güncelleme

Uygulamada bir değişiklik yaptığınızda GitHub'daki ilgili dosyayı değiştirmeniz yeterli (dosyayı aç → kalem simgesi ya da yeniden yükle). Vercel birkaç saniye içinde siteyi otomatik günceller.

## Nasıl çalışıyor (kısaca)

- **index.html**: uygulamanın kendisi (telefonda açılan ekranlar).
- **api/**: Vercel'de çalışan sunucu fonksiyonları — giriş (`auth`), kayıtlar (`data`), belediyenin toplaması (`collect`), örnek hesaplar (`demo`), fotoğraf analizi ve eylem planı (`ai`).
- **Supabase**: hesaplar ve kayıtlar burada. Tarayıcı veritabanına doğrudan erişemez; tüm okuma/yazma sunucu fonksiyonlarından geçer.
- Şifreler sunucuda özetlenerek (scrypt) saklanır; API anahtarları yalnızca Vercel'de durur.
- Restoranlar birbirinin yalnızca rota için gereken bilgisini (bekleyen kg, hazır bildirimi) görür; belediye kendi ilçesindeki restoranların tüm kayıtlarını görür.

Not: Vercel'in ücretsiz (Hobby) planı kişisel ve ticari olmayan projeler içindir. Belediyeyle resmî bir pilota geçerken plan koşullarını kontrol edin.

---

## Güncelleme: Canlı yüklemeler (telefon → bilgisayar)

Bu sürümle telefondan fotoğrafla eklenen kayıt, aynı hesabın (ya da ilçe belediyesinin) açık olduğu bilgisayarda birkaç saniye içinde fotoğrafı ve analiziyle görünür.

1. **Supabase → SQL Editor → New query**: `supabase/v2-fotograflar.sql` dosyasının içeriğini yapıştırıp **Run**. (İlk kurulumu bu sürümle yapıyorsanız `schema.sql` zaten içeriyor.)
2. Değişen dosyaları GitHub'a gönderin:
   ```
   git add index.html api/photo.js api/feed.js lib/db.js supabase/
   git commit -m "Canlı yüklemeler ve fotoğraf saklama"
   git push
   ```
3. Deneme: bilgisayarda restoran hesabıyla **Pano**'yu açın. Telefonda aynı hesapla **Ekle → Fotoğraf çek → Analiz et → Kaydet ve hesapla**. Bilgisayarın üstünde "… yüklendi" bildirimi çıkar; **Gör**'e basınca fotoğraf, karbon, maliyet ve kalem kalem analiz açılır. Belediye hesabı da **Bugün** sekmesinde ilçesindeki yüklemeleri aynı şekilde görür.

Notlar: Fotoğrafın küçültülmüş bir kopyası (en fazla 720 px) saklanır. Bilgisayar her 5 saniyede bir yeni kayıt olup olmadığına bakar. Restoranlar birbirlerinin fotoğraflarını göremez; belediye yalnızca kendi ilçesindekileri görür.

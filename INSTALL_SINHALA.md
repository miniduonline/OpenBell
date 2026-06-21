# OpenBell — ස්ථාපන හා භාවිත උපදෙස් (සිංහල)

## OpenBell යනු කුමක්ද?

**OpenBell** යනු පාසල්, විද්‍යාල, විශ්ව විද්‍යාල, පුහුණු ආයතන සහ කාර්යාල සඳහා නිර්මාණය කරන ලද නවීන, විවෘත මූලාශ්‍ර (open-source) **බෙල් කලමනාකරණ පද්ධතියකි**. මෙය Windows, macOS, සහ Linux යන සියලුම මෙහෙයුම් පද්ධතිවල ක්‍රියාත්මක වේ.

## ප්‍රධාන විශේෂාංග

- 🔔 ස්වයංක්‍රීයව බෙල් නාද කිරීම (කාලසටහන අනුව)
- 📅 සතිපතා කාලසටහන් සහ නිවාඩු දින කලමනාකරණය
- 🎵 MP3 / WAV බෙල් ශබ්ද උඩුගත කිරීම සහ පූර්වදර්ශනය
- 💾 ස්වයංක්‍රීය හා මාරුවෙන් උපස්ථ (Backup) කිරීම
- 🌗 ලයිට් / ඩාක් මෝඩ්
- 🌐 සිංහල, தமிழ், English භාෂා සහාය

---

## 1. ස්ථාපනය කරන ආකාරය (සරල පරිශීලකයින් සඳහා)

1. ව්‍යාපෘතියේ **Releases** පිටුවට යාම.
2. ඔබේ පරිගණකයට ගැළපෙන ස්ථාපන ගොනුව බාගත කරන්න:
   - Windows → `OpenBell-Setup.exe`
   - macOS → `OpenBell.dmg`
   - Linux → `OpenBell.AppImage`
3. බාගත කළ ගොනුව ක්‍රියාත්මක කර, "Next" ක්ලික් කරමින් ස්ථාපනය සම්පූර්ණ කරන්න.
4. ස්ථාපනය අවසන් වූ පසු, Start Menu / Applications වෙතින් **OpenBell** විවෘත කරන්න.

---

## 2. සංවර්ධකයින් සඳහා (Developer Setup) — Source Code එක Run කරන ආකාරය

### අවශ්‍ය මෙවලම්

- Node.js (v18 හෝ ඊට වැඩි)
- npm
- Git

### පියවර

```bash
git clone https://github.com/openbell/openbell.git
cd openbell
npm install
npm run dev
```

මෙම විධාන ක්‍රියාත්මක කළ පසු, OpenBell ඇප්ලිකේෂන් එක ස්වයංක්‍රීයව විවෘත වනු ඇත.

### Production Build එකක් සකස් කිරීම

```bash
npm run build
npm run build:win     # Windows .exe සඳහා
npm run build:mac     # macOS .dmg සඳහා
npm run build:linux   # Linux AppImage සඳහා
```

සකස් කළ ස්ථාපන ගොනු `release/` ෆෝල්ඩරයේ ලැබේ.

---

## 3. දත්ත ගබඩාව (Database) පිළිබඳ තොරතුරු

OpenBell SQLite දත්ත ගබඩාවක් භාවිතා කරයි. එය ස්වයංක්‍රීයව සුරැකෙන ස්ථානය:

- **Windows**: `%APPDATA%\OpenBell\data\openbell.db`
- **macOS**: `~/Library/Application Support/OpenBell/data/openbell.db`
- **Linux**: `~/.config/OpenBell/data/openbell.db`

නියැදි දත්ත (Sample Data) ලබා ගැනීමට `sample-data/seed.sql` ගොනුව භාවිතා කරන්න.

---

## 4. භාෂාව මාරු කරන ආකාරය

ඇප්ලිකේෂන් එක තුළ ඉහළ දකුණු කෙළවරේ ඇති භාෂා මෙනුවෙන් **සිංහල**, **தமிழ்**, හෝ **English** තෝරාගත හැක. තේරීම ස්වයංක්‍රීයව සුරැකෙයි.

## 5. උපස්ථ (Backup) කිරීම සහ ප්‍රතිස්ථාපනය (Restore) කිරීම

- **Backup** පිටුවට ගොස් "Backup Now" ක්ලික් කිරීමෙන් ක්ෂණික උපස්ථයක් ගත හැක.
- සතියකට වරක් ස්වයංක්‍රීය උපස්ථයක් ස්වයංක්‍රීයව සිදු වේ.
- පැරණි උපස්ථයකින් දත්ත ප්‍රතිස්ථාපනය කිරීමට "Restore" ක්ලික් කර, `.db` ගොනුව තෝරන්න.

## 6. ගැටළු වාර්තා කිරීම (Issues / Bug Report)

ඔබට යම් දෝෂයක් හමු වුවහොත් GitHub Issues හරහා වාර්තා කරන්න. Bug Report Template එක භාවිතා කරන්න.

---

### සහයෝගය ලබා ගැනීම

ගැටළු හෝ ප්‍රශ්න ඇත්නම් GitHub Repository හි **Issues** කොටසේ පළ කරන්න. OpenBell විවෘත මූලාශ්‍ර ව්‍යාපෘතියක් වන බැවින් ඔබටද contribute කිරීමට (CONTRIBUTING.md බලන්න) හැකියාව ඇත.

🔔 **OpenBell** — ඔබේ ආයතනය සඳහා නවීන, විශ්වසනීය බෙල් කලමනාකරණ විසඳුම.

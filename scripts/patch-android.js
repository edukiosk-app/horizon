// Ajoute les permissions Bluetooth, l'icône et la couleur d'Horizon au projet Android généré par Capacitor.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const man = path.join(root, 'android/app/src/main/AndroidManifest.xml');
let x = fs.readFileSync(man, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />',
];
if (!x.includes('xmlns:tools')) x = x.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
perms.forEach((p) => { const name = p.match(/name="([^"]+)"/)[1]; if (!x.includes(name + '"')) x = x.replace('</manifest>', '    ' + p + '\n</manifest>'); });
x = x.replace(/android:screenOrientation="[^"]*"/, '');
fs.writeFileSync(man, x);
const res = path.join(root, 'android/app/src/main/res');
['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].forEach((d) => {
  const dir = path.join(res, 'mipmap-' + d);
  if (!fs.existsSync(dir)) return;
  [['ic_launcher', 'ic_launcher'], ['ic_launcher_round', 'ic_launcher_round'], ['ic_launcher_foreground', 'ic_launcher_foreground']].forEach(([src, dst]) => {
    const f = path.join(root, 'resources', `${src}-${d}.png`);
    if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, dst + '.png'));
  });
});
const bg = path.join(res, 'values/ic_launcher_background.xml');
if (fs.existsSync(bg)) fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1C1F23</color>\n</resources>\n');
console.log('Projet Android préparé pour Horizon.');

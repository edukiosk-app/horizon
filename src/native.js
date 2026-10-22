// Pont entre Treadverse et Android : Bluetooth, voix, écran allumé, partage.
import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Share } from '@capacitor/share';

if (Capacitor.isNativePlatform()) {
  const NAMES = { heart_rate: 0x180d, heart_rate_measurement: 0x2a37, fitness_machine: 0x1826 };
  const uuid = (x) => {
    if (typeof x === 'number') return numberToUUID(x);
    if (NAMES[x] != null) return numberToUUID(NAMES[x]);
    return String(x).toLowerCase();
  };
  let ready = null;
  const init = () => (ready = ready || BleClient.initialize({ androidNeverForLocation: true }));

  class Characteristic {
    constructor(dev, svc, ch) { this.d = dev; this.s = svc; this.c = ch; this.l = []; }
    addEventListener(name, f) { if (name === 'characteristicvaluechanged') this.l.push(f); }
    async readValue() { return BleClient.read(this.d, this.s, this.c); }
    async writeValueWithResponse(bytes) {
      const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      return BleClient.write(this.d, this.s, this.c, new DataView(u.buffer, u.byteOffset, u.byteLength));
    }
    async writeValue(bytes) { return this.writeValueWithResponse(bytes); }
    async startNotifications() {
      await BleClient.startNotifications(this.d, this.s, this.c, (value) => {
        const ev = { target: { value } };
        this.l.forEach((f) => { try { f(ev); } catch (e) {} });
      });
      return this;
    }
  }
  class Service {
    constructor(dev, svc) { this.d = dev; this.s = svc; }
    async getCharacteristic(x) { return new Characteristic(this.d, this.s, uuid(x)); }
  }
  class Device {
    constructor(r) {
      this.id = r.deviceId; this.name = r.name || 'Appareil'; this.l = [];
      this.gatt = {
        connected: false,
        connect: async () => {
          await BleClient.connect(this.id, () => { this.gatt.connected = false; this.l.forEach((f) => f()); });
          this.gatt.connected = true;
          return { getPrimaryService: async (x) => new Service(this.id, uuid(x)) };
        },
        disconnect: () => BleClient.disconnect(this.id),
      };
    }
    addEventListener(name, f) { if (name === 'gattserverdisconnected') this.l.push(f); }
  }
  const bluetooth = {
    async requestDevice(opt = {}) {
      await init();
      const services = (opt.filters || []).flatMap((f) => f.services || []).map(uuid);
      const r = await BleClient.requestDevice(services.length ? { services } : {});
      return new Device(r);
    },
  };
  try { Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true }); } catch (e) { navigator.bluetooth = bluetooth; }

  // Partage (WhatsApp, SMS…) : la WebView d'Android n'a pas navigator.share
  try { Object.defineProperty(navigator, 'share', { value: (o) => Share.share({ title: o.title, text: o.text, url: o.url, dialogTitle: 'Envoyer le défi' }), configurable: true }); } catch (e) {}

  // Écran toujours allumé pendant la course
  try {
    Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { await KeepAwake.keepAwake(); return { release: () => KeepAwake.allowSleep() }; } }, configurable: true });
  } catch (e) {}

  // Voix : moteur de synthèse d'Android
  window.NativeTTS = {
    speak: (text, lang, rate) => TextToSpeech.speak({ text, lang, rate: rate || 1.0, pitch: 1.0, volume: 1.0, category: 'playback', queueStrategy: 1 }).catch(() => {}),
    stop: () => TextToSpeech.stop().catch(() => {}),
  };
  window.HORIZON_ANDROID = true;
  document.documentElement.classList.add('android');
}

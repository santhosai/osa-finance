// Shared ESC/POS thermal printer helper, using the same Web Bluetooth mechanism
// already proven in Dashboard.jsx (same service UUIDs, same characteristic-discovery
// loop, same 100-byte chunking). Extracted here so new callers (e.g. Festival Fund)
// reuse this instead of copy-pasting a fourth copy of the connect/write logic.

const ESC = '\x1B';
const GS = '\x1D';

export const THERMAL_COMMANDS = {
  INIT: ESC + '@',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  DOUBLE_HEIGHT: GS + '!' + '\x10',
  NORMAL_SIZE: GS + '!' + '\x00',
  FEED: ESC + 'd' + '\x03',
  PARTIAL_CUT: GS + 'V' + '\x01',
  LINE: '--------------------------------\n',
  DASHED: '- - - - - - - - - - - - - - - -\n'
};

const THERMAL_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];

// Prompts the OS Bluetooth device picker (same paired thermal printer used elsewhere
// in the app), connects, and streams the ESC/POS receipt text to it in 100-byte chunks.
export async function printViaBluetooth(receiptText) {
  if (!navigator.bluetooth) {
    alert('Bluetooth not supported. Use the Normal Print option or RawBT app.');
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: THERMAL_SERVICE_UUIDS
    });

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let characteristic = null;

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      } catch (_) {}
    }

    if (!characteristic) {
      alert('Printer not compatible');
      return;
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(receiptText);
    const chunkSize = 100;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    alert('Printed successfully!');
  } catch (error) {
    console.error('Print error:', error);
    alert('Print failed: ' + error.message);
  }
}

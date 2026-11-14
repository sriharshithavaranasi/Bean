// WiFi transport through the camera board on the car (kit version with the ESP32 camera).
// The laptop joins the car's own WiFi (ELEGOO-...); scripts/serve.mjs holds the connection to the car and relays it here,
// because a web page cannot open the car's plain TCP port.
import { makeLink } from './robot.js';

export function connectWifi(onLost) {
  return new Promise((resolve, reject) => {
    const car = new EventSource('/car');
    // The command goes car-ward over the server; the camera board passes it to the car's main board.
    const link = makeLink(async (text) => {
      const r = await fetch('/car/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: text });
      if (!r.ok) throw new Error('car not connected');
    }, 800); // WiFi plus the camera board's serial hop is slower than the cable
    let open = false;
    car.onopen = () => {
      open = true;
      resolve(link.robot);
    };
    car.onmessage = (e) => link.receive(JSON.parse(e.data));
    car.onerror = () => {
      car.close();
      if (open) onLost();
      else reject(new Error('cannot reach the car'));
    };
  });
}

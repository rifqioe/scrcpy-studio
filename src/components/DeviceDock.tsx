import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useDevices } from "../state/devices";
import { useConfig } from "../state/config";
import {
  adbConnect,
  adbPair,
  goWireless,
  qrPairStart,
  onQrPairResult,
  errMessage,
  type QrSession,
} from "../lib/ipc";
import { Button } from "./ui";
import { BinaryManager } from "./BinaryManager";

export function DeviceDock() {
  const { devices, selected, select, refresh, loading, error } = useDevices();
  const patch = useConfig((s) => s.patch);
  const [connectAddr, setConnectAddr] = useState("");
  const [pairAddr, setPairAddr] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [qrStatus, setQrStatus] = useState<string>();

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  // Listen for QR pairing results emitted from the Rust mDNS watcher.
  useEffect(() => {
    const un = onQrPairResult((e) => {
      setQrStatus(e.message);
      if (e.success) {
        setQr(null);
        refresh();
      }
    });
    return () => {
      un.then((f) => f());
    };
  }, [refresh]);

  async function doGoWireless() {
    if (!selected) return;
    setBusy(true);
    setMsg("Switching to Wi-Fi…");
    try {
      const addr = await goWireless(selected);
      select(addr);
      setMsg(`Wireless: ${addr}. Cable can be unplugged now.`);
      await refresh();
    } catch (e) {
      setMsg(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function startQr() {
    setQrStatus(undefined);
    try {
      setQr(await qrPairStart());
      setQrStatus("Scan in: Developer options → Wireless debugging → Pair device with QR code.");
    } catch (e) {
      setQrStatus(errMessage(e));
    }
  }

  // Mirror the selected serial into the launch config.
  useEffect(() => {
    patch("connect", { serial: selected });
  }, [selected, patch]);

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(undefined);
    try {
      const out = await fn();
      setMsg(out || "ok");
      await refresh();
    } catch (e) {
      setMsg(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-950 p-3 overflow-y-auto">
      <BinaryManager />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Devices</h3>
          <Button variant="ghost" onClick={refresh} title="Refresh">
            {loading ? "…" : "↻"}
          </Button>
        </div>
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        {devices.length === 0 && !error && (
          <p className="text-xs text-zinc-500">No devices. Plug in over USB or connect below.</p>
        )}
        <ul className="flex flex-col gap-1">
          {devices.map((d) => (
            <li key={d.serial}>
              <button
                onClick={() => select(d.serial)}
                className={
                  "w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors " +
                  (selected === d.serial
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 hover:border-zinc-700")
                }
              >
                <div className="font-medium text-zinc-100">{d.model ?? d.serial}</div>
                <div className="flex justify-between text-zinc-500">
                  <span className="truncate">{d.serial}</span>
                  <span className={d.state === "device" ? "text-emerald-400" : "text-amber-400"}>
                    {d.state}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Wireless</h3>
        <div className="flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
            placeholder="ip:port"
            value={connectAddr}
            onChange={(e) => setConnectAddr(e.target.value)}
          />
          <Button disabled={busy || !connectAddr} onClick={() => act(() => adbConnect(connectAddr))}>
            Connect
          </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-zinc-800 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Pair via QR (Android 11+)</span>
            <Button variant="ghost" onClick={startQr} disabled={busy}>
              {qr ? "New code" : "QR"}
            </Button>
          </div>
          {qr && (
            <div className="flex flex-col items-center gap-1.5 rounded-md bg-white p-2">
              <QRCodeSVG value={qr.payload} size={150} />
            </div>
          )}
          {qr && (
            <div className="text-center text-[11px] text-zinc-400">
              code <span className="font-mono text-emerald-300">{qr.code}</span>
            </div>
          )}
          {qrStatus && <p className="break-words text-[11px] text-zinc-400">{qrStatus}</p>}
        </div>

        <div className="flex flex-col gap-1.5 rounded-md border border-zinc-800 p-2">
          <span className="text-[11px] text-zinc-500">Pair manually (Android 11+)</span>
          <input
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
            placeholder="ip:port (pairing)"
            value={pairAddr}
            onChange={(e) => setPairAddr(e.target.value)}
          />
          <div className="flex gap-1.5">
            <input
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
              placeholder="6-digit code"
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
            />
            <Button
              disabled={busy || !pairAddr || !pairCode}
              onClick={() => act(() => adbPair(pairAddr, pairCode))}
            >
              Pair
            </Button>
          </div>
        </div>
        <Button
          disabled={busy || !selected || selected.includes(":")}
          onClick={doGoWireless}
          title="Read the device IP, switch it to TCP/IP, and connect over Wi-Fi so it survives unplugging the cable"
        >
          Go wireless (USB → Wi-Fi)
        </Button>
        {msg && <p className="break-words text-[11px] text-zinc-400">{msg}</p>}
      </section>
    </aside>
  );
}

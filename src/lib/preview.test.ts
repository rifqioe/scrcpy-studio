import { describe, it, expect } from "vitest";
import { buildArgv, buildPreview } from "./preview";
import { defaultArgs } from "./types";

describe("buildArgv", () => {
  it("produces no flags for default args", () => {
    expect(buildArgv(defaultArgs())).toEqual([]);
  });

  it("emits serial and video flags", () => {
    const a = defaultArgs();
    a.connect.serial = "ABC123";
    a.video.codec = "h265";
    a.video.maxSize = 1024;
    a.video.bitRate = "8M";
    const argv = buildArgv(a);
    expect(argv).toContain("-s");
    expect(argv).toContain("ABC123");
    expect(argv).toContain("--video-codec=h265");
    expect(argv).toContain("--max-size=1024");
    expect(argv).toContain("--video-bit-rate=8M");
  });

  it("emits boolean flags only when true", () => {
    const a = defaultArgs();
    a.control.turnScreenOff = true;
    const argv = buildArgv(a);
    expect(argv).toContain("--turn-screen-off");
    expect(argv).not.toContain("--stay-awake");
  });

  it("handles bare and addressed --tcpip", () => {
    const bare = defaultArgs();
    bare.connect.tcpip = "";
    expect(buildArgv(bare)).toContain("--tcpip");

    const addr = defaultArgs();
    addr.connect.tcpip = "192.168.1.5:5555";
    expect(buildArgv(addr)).toContain("--tcpip=192.168.1.5:5555");
  });

  it("appends extra args verbatim", () => {
    const a = defaultArgs();
    a.extraArgs = "--list-displays --foo=bar";
    const argv = buildArgv(a);
    expect(argv).toContain("--list-displays");
    expect(argv).toContain("--foo=bar");
  });

  it("emits bare --new-display when enabled without spec", () => {
    const a = defaultArgs();
    a.virtualDisplay.enabled = true;
    expect(buildArgv(a)).toContain("--new-display");
  });
});

describe("buildPreview", () => {
  it("prefixes the command with scrcpy", () => {
    const a = defaultArgs();
    a.window.fullscreen = true;
    expect(buildPreview(a)).toBe("scrcpy --fullscreen");
  });
});

// A QR code as inline SVG drawn in currentColor; the page shows it dark on white in both themes (inverted codes scan badly).
import QRCode from "qrcode";

export async function qrSvg(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff00" } });
  return svg.replace(/stroke="#000000"/g, 'stroke="currentColor"');
}

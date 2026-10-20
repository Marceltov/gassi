// A QR code as inline SVG in the page's text colour, so it shows in light and dark mode.
import QRCode from "qrcode";

export async function qrSvg(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff00" } });
  return svg.replace(/stroke="#000000"/g, 'stroke="currentColor"');
}

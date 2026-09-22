// Original SVG, retrieved from https://www.bbe.de/static/images/bbe-logo.svg on 2026-09-10.
export const BBE_LOGO =
  'data:image/svg+xml;base64,PHN2ZyBpZD0iRWJlbmVfMSIgZGF0YS1uYW1lPSJFYmVuZSAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5MC43MSA5MC43MSI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMDRmODc7fS5jbHMtMntmaWxsOiNmZmY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMSIgd2lkdGg9IjkwLjcxIiBoZWlnaHQ9IjkwLjcxIi8+PHBhdGggY2xhc3M9ImNscy0yIiBkPSJNMjQuMzksNTguNjVjLTEuNCwwLTMuOC0uMTEtNy0uMTFIMTQuMVY1NmEyMS41NywyMS41NywwLDAsMSwzLjMtLjVWMzUuODlhMjAuNDMsMjAuNDMsMCwwLDEtMy4zLS40OVYzMi44OWgzLjE5YzEuOTMsMCw0Ljc1LS4xMSw3Ljg2LS4xMSw1LjUxLDAsOC4zNiwyLjI4LDguMzYsNi4yM2E2LDYsMCwwLDEtNCw1Ljg1di4wN2E1LjgzLDUuODMsMCwwLDEsNSw1Ljg2QzM0LjUsNTQuMTMsMzIuMjksNTguNjUsMjQuMzksNTguNjVabS4wOC0yMi41N2MtMS4xNCwwLTIsMC0zLC4wOHY3LjZjLjY5LDAsMS4zMywwLDIuMjEsMCwzLjg0LDAsNS40Ny0xLjU1LDUuNDctNC4xNEMyOS4xOCwzNy41NiwyOCwzNi4wOCwyNC40NywzNi4wOFptLS42NSwxMC43OWMtLjQyLDAtMS43NSwwLTIuMzIsMHY4LjE3YTIwLjQsMjAuNCwwLDAsMCwzLjA4LjE5YzMuNzYsMCw1LjUxLTEuODIsNS41MS00LjQxQzMwLjA5LDQ3Ljk0LDI3LjQzLDQ2Ljg3LDIzLjgyLDQ2Ljg3WiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCAwKSIvPjxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTQ3LjIzLDU4LjY1Yy0xLjQxLDAtMy44LS4xMS03LS4xMUgzNi45M1Y1NmEyMS44OSwyMS44OSwwLDAsMSwzLjMxLS41VjM1Ljg5YTIwLjcyLDIwLjcyLDAsMCwxLTMuMzEtLjQ5VjMyLjg5aDMuMTljMS45NCwwLDQuNzUtLjExLDcuODctLjExLDUuNTEsMCw4LjM2LDIuMjgsOC4zNiw2LjIzYTYsNiwwLDAsMS00LDUuODV2LjA3YTUuODMsNS44MywwLDAsMSw1LDUuODZDNTcuMzQsNTQuMTMsNTUuMTMsNTguNjUsNDcuMjMsNTguNjVabS4wNy0yMi41N2MtMS4xMywwLTIsMC0zLC4wOHY3LjZjLjY5LDAsMS4zMywwLDIuMiwwLDMuODQsMCw1LjQ4LTEuNTUsNS40OC00LjE0QzUyLDM3LjU2LDUwLjg0LDM2LjA4LDQ3LjMsMzYuMDhabS0uNjQsMTAuNzljLS40MiwwLTEuNzUsMC0yLjMyLDB2OC4xN2EyMC40LDIwLjQsMCwwLDAsMy4wOC4xOWMzLjc2LDAsNS41MS0xLjgyLDUuNTEtNC40MUM1Mi45Myw0Ny45NCw1MC4yNyw0Ni44Nyw0Ni42Niw0Ni44N1oiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAgMCkiLz48cGF0aCBjbGFzcz0iY2xzLTIiIGQ9Ik01OS43Nyw1OC41NFY1NmEyMS44OSwyMS44OSwwLDAsMSwzLjMxLS41VjM1Ljg5YTIwLjcyLDIwLjcyLDAsMCwxLTMuMzEtLjQ5VjMyLjg5aDE3djYuMTZoLTNjLS4xOS0xLjA3LS4zOC0yLjA5LS40NS0yLjg5SDY3LjE4djcuNjdoNC45YTE0Ljc3LDE0Ljc3LDAsMCwxLC40OS0yLjM1aDIuNTl2Ny43NUg3Mi41N2ExMy4zNiwxMy4zNiwwLDAsMS0uNDktMi4zNmgtNC45djguMzJoNi4xNWEyNy4zMiwyNy4zMiwwLDAsMSwuNS0zaDN2Ni4zOVoiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAgMCkiLz48L3N2Zz4=';
let logo;
function originalLogo() {
  if (typeof Image === 'undefined') return null;
  logo ||= new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = BBE_LOGO;
  });
  return logo;
}

// Existing indoor signs intentionally keep their original wide artwork.
export function brandTexture(texture, subtitle = '') {
  const ready = originalLogo();
  if (!ready) return;
  ready.then((im) => {
    if (!im) return;
    const canvas = texture.image,
      c = canvas.getContext('2d');
    c.fillStyle = '#004f87';
    c.fillRect(0, 0, 1024, 256);
    c.drawImage(im, 12, 12, 232, 232);
    c.fillStyle = '#fff';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.font = '500 62px Arial';
    c.fillText('Handelsberatung', 280, subtitle ? 106 : 128, 720);
    if (subtitle) {
      c.font = '28px Arial';
      c.fillText(subtitle, 280, 174, 710);
    }
    texture.needsUpdate = true;
  });
}

/** Full-square original SVG artwork, isolated from facade metric UVs and indoor labels. */
export function brandLogoTexture(texture) {
  texture.name = 'BBE · original square SVG artwork';
  texture.userData.bbeLogoOnly = true;
  texture.userData.bbeLogoReady = false;
  const ready = originalLogo();
  if (!ready) return Promise.resolve(false);
  return ready.then((im) => {
    const canvas = texture.image;
    if (!im || !canvas?.getContext) return false;
    const c = canvas.getContext('2d');
    const width = canvas.width,
      height = canvas.height;
    const side = Math.min(width, height);
    c.clearRect(0, 0, width, height);
    c.fillStyle = '#004f87';
    c.fillRect(0, 0, width, height);
    c.drawImage(im, (width - side) / 2, (height - side) / 2, side, side);
    texture.userData.bbeLogoReady = true;
    texture.needsUpdate = true;
    return true;
  });
}

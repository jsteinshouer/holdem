// Seats sit on one elliptical field, and the ring is rotated so the viewer is
// always at six o'clock with opponents arcing clockwise above them. 90deg is the
// bottom of the ellipse because CSS y grows downward.
//
// This is the only seat topology in the app: the ellipse reshapes through
// container queries, so a phone and a desktop render the same DOM rather than
// two trees toggled by display: none.
export function seatAngles(seatCount, viewerSeatIndex) {
    const step = 360 / seatCount;
    return Array.from({ length: seatCount }, (_, index) => {
        const offset = (index - viewerSeatIndex + seatCount) % seatCount;
        // Normalised to 0-360 so the value reads plainly in DevTools; the
        // rendering is identical either way.
        return (90 + offset * step) % 360;
    });
}

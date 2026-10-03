/** Office-local coordinates, based on release 44d376a. No global nearest-target override. */
import { COFFEE_REACH } from './coffee-tray-grip.js';
const kitchen = COFFEE_REACH.kitchen,
  meeting = COFFEE_REACH.meeting;
export const COFFEE_PITCH_LOCATIONS = Object.freeze({
  kitchen: Object.freeze({ id: 'coffee-pitch-kitchen', x: 9.15, z: 7.1, radius: 0.65 }),
  meeting: Object.freeze({ id: 'coffee-pitch-meeting', x: 5.25, z: -0.7, radius: 0.65 }),
  // Counter top .975; the authored tray underside is local y=.001.
  tray: Object.freeze({ x: kitchen.trayX, y: kitchen.trayY, z: kitchen.trayZ }),
  served: Object.freeze({ x: 6.09, y: 0.865, z: -0.61 }),
  kitchenApproach: kitchen,
  meetingApproach: meeting,
  servingTray: Object.freeze({
    x: meeting.trayX,
    y: meeting.trayY,
    z: meeting.trayZ,
    yaw: meeting.yaw,
  }),
  // Actual walkable route around the glass wall, not a straight line through it.
  route: Object.freeze([
    Object.freeze([9.15, 7.1]),
    Object.freeze([2.1, 5.1]),
    Object.freeze([2.1, -3.7]),
    Object.freeze([4.7, -3.7]),
    Object.freeze([5.25, -0.7]),
  ]),
});

// The two cars in the match: the player (blue) and the computer (orange).
import { Car } from '../entities/car.js';

export const player = new Car('blue', true);
export const bot = new Car('orange', false);
export const cars = [player, bot];

# Bill the duck: our `[CHARACTER]`

Bill is a duck in a suit who is lazy, scruffy and terrible with money. He fills the `[CHARACTER]` slot in `GAME_BRIEF.md` §9. He is built from Three.js primitives (option B), so there is no model file to load and nothing to rig.

**Name:** a duck has a bill, and a bill is something you pay. Bill never pays his.

## Files

| File | What it is |
|---|---|
| `client/src/render/character.ts` | The 3D character. Implements the `CharacterView` interface from the brief |
| `docs/character/bill.svg` | Clean 2D art for the lobby, results screen and pitch slides |
| `docs/character/bill-concept-sheet.svg` | The same art with every part of his look labelled |
| `client/character-preview.html` + `client/src/dev/character-preview.ts` | A dev page showing Bill in every pose |

## See him in your browser

You need Node 20.19+ or 22.12+ (check with `node -v`). After pulling:

```bash
cd client
npm install
npm run character
```

That opens `http://localhost:5173/character-preview.html`. It shows Bill and his ghost side by side, with a button for every pose. Drag to orbit and scroll to zoom. Adding `?pose=fly` to the URL starts on that pose. Press `Ctrl+C` in the terminal to stop it.

The page loads `character.ts` directly, so it always shows the latest Bill.

## Using him in the game

```ts
import { createCharacter } from './render/character';

const bill = createCharacter();
scene.add(bill.object);
bill.setPose('run');

// every frame
bill.update(dtSeconds);

// the leader's ghost
const ghost = createCharacter();
ghost.setGhost(true);
scene.add(ghost.object);
```

- Origin at the feet, facing +Z, about 1.8 units tall, as the brief asks. His left is +X.
- He only animates. Hitboxes stay in `sim/constants.ts`, so swapping him in changes no gameplay.
- `createCharacter({ coatColor: 0x2b3a67 })` gives him a different coat if we ever want colour variants.

## Poses

| Pose | What Bill does | Lasts |
|---|---|---|
| `idle` | Sways, looks around, blinks half-asleep | Until changed |
| `run` | Waddles with legs swinging, body rocking, tie and tail flapping | Until changed |
| `laneLeft` / `laneRight` | Leans into the lane change while still running | 0.3 s, then back |
| `hit` | Spins round, cap pops off, coins burst out of his pockets | 0.6 s, then back |
| `fly` | Body flat, legs tucked, wings flapping (still holding the latte) | Until changed |
| `attack` | Lunges and pecks with his bill | 0.45 s, then back |
| `victory` | Hops with wings up, cap twirling, eyes finally open | Until changed |
| `fail` | Flops on his back, legs kicking, cap knocked off | Until changed |

`laneLeft`, `laneRight`, `hit` and `attack` are short reactions. They play on top of whatever he was doing (`run`, `fly` or `idle`) and then hand back to it on their own, so the caller never has to switch back.

The ghost is translucent with a blue tint, casts no shadow and never drops coins.

## His look

| Part | Detail | Colour |
|---|---|---|
| Feathers | White, long neck, tail feathers poking out of the coat | `#fdfaf2` |
| Bill and legs | Orange, with a toothpick in the corner of his bill | `#f39c32` |
| Coat | Crumpled brown, one lapel flipped up, buttoned wrong | `#7a5c3e` |
| Tie | Red, loose, swings about | `#c0392b` |
| Flat cap | Grey, worn wonky, sunglasses parked on top | `#4b4f58` |
| Eyes | Half-closed lids, he always looks half-asleep | `#e7dfcf` lids |
| Boots | Mismatched: one brown, one black with his toe through a hole, laces undone | `#5a3b22` / `#2f2f2f` |
| Money | Banknotes poking out of his pocket, a £7 latte in his wing | `#7fb77e` notes |

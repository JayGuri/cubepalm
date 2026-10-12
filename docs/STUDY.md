# Helping with CubePalm: two small tasks

Thank you for helping. There are two tasks. Each takes about ten minutes, needs no installation, and can be done without anyone explaining it. Do either or both.

You need a phone, a tablet or a computer with a camera, and a recent Chrome, Edge, Safari or Firefox. Open **https://cubepalm.vercel.app**. If you have more than one device, doing Task 1 on each of them is especially useful: cameras differ, and that is one of the things being measured.

## What is and is not collected

- **Task 1** saves the positions of 21 points on each of your hands, about 25 times a second, for two minutes. It saves no picture and no video. The file cannot show your face, your room or who you are.
- **Task 2** saves a list of the turns you made on the cube: when, with which input method, and whether you were following the on-screen guide. It saves nothing else.
- Neither task sends anything. Each ends with a file on your own computer, which you then choose to send. You can open either file in a text editor to see exactly what is in it.
- You can stop at any point and send nothing.

## Task 1: record your hand signs (about 3 minutes)

1. Sit so the camera can see both hands from about an arm's length, with your face to a window or a light if you can. On a phone or tablet, stand it up against something first so both hands are free and it does not move.
2. Go to **Settings**, then **Record** (beside "Help measure hand tracking").
3. Answer the three questions (your light, your distance, your device), then press **I agree, start recording**. Allow the camera when the browser asks.
4. The page shows 24 hand shapes, one at a time: twelve for your right hand, then twelve for your left. For each one it says **Get ready**, then **Recording, hold still**. Make the shape during "get ready" and hold it until the next one appears.
   - Nine are finger signs, shown as a small picture: raise the lit fingers and fold the others. The thumb does not matter.
   - Three are not signs: a relaxed half-open hand, an open hand, and a fist.
   - Use only the hand it names. Keep the other one out of the picture.
5. At the end press **Send the recording** (on a phone or tablet, this opens your usual sharing menu) or **Download the recording**. The file is named `cubepalm-hands-<device>-<light>-<date>.json`.

If you make a mistake on one shape, carry on; one bad clip does not spoil the rest. If something goes badly wrong, reload the page and start again.

**Please do it twice: once in bright light and once in dim light** (a room with the main light off, or the curtains closed), answering the first question accordingly each time. If you have a second device, the same two recordings on it are worth as much again.

## Task 2: turn the cube four ways (about 10 minutes)

The cube can be turned by dragging, by keyboard, by on-screen buttons (on a touch screen) and by hand signs. This task compares them.

1. Go to **3×3** in the menu.
2. Press **Scramble**, wait for the cube to finish mixing, then press **Guide me**. A gold arrow shows the next turn, and the panel above the cube names it.
3. Follow the guide until the cube is solved, using **only the keyboard**: the keys R, U, F, L, D, B turn a face clockwise, and Shift with the key turns it the other way.
4. Do steps 2 and 3 again using **only dragging**: drag a piece of the cube in the direction the arrow shows.
5. Do steps 2 and 3 again using **only hand signs**: switch from **Mouse** to **Hands** at the top right, allow the camera, and make the sign the panel shows. Right hand turns clockwise, left hand the other way. Hold each sign still until its ring fills.
6. If you are on a phone or tablet, do it once more with the row of turn buttons under the cube.
7. Go to **Settings**, then **Open** (beside "Your numbers"), and press **Download as a file**. The file is named `cubepalm-usage.json`.

Do not worry about speed or mistakes. A wrong turn is useful information: the guide notices and tells you how to get back.

## Sending the files

Send the file or files to the person who asked you, by whatever means you normally use. Please also say, in a sentence:

- whether you have used a Rubik's Cube before, and
- anything that was confusing or that did not work.

## For the person running the study

- Put hand recordings in `research/recordings/` and run `npm run research`. The report at `docs/research/sign-recognition.md` gains a section scoring every reader on them. That folder ignores `*.json`, so recordings are not committed by accident; ask each person before sharing theirs.
- Usage files are read by eye for now, or loaded into the stats page's own summary code (`summariseUsage` in `src/state/usageLog.ts`).
- Keep a note of who sent what only if they are happy for you to, and do not put names in file names.
- Five people in two lighting conditions each is enough to say something about the readers. Fewer is still worth having. Different people matter most (hands differ more than cameras do); different devices come second, and the report breaks results down by device and light.

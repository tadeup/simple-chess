# Third-party notices

## Chess pieces: "cburnett" set by Colin M. L. Burnett

Used in `src/pieces/*.svg`, `assets/icon.svg` and the generated app icons. Its author offers the set under several licenses (GPL, GFDL, CC BY-SA and BSD); this project uses it under the BSD license:

> Copyright (c) Colin M. L. Burnett. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Icons: adapted from Lucide (ISC license)

Used in the inline SVG sprite in `index.html`.

> ISC License. Copyright (c) Lucide Contributors.
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## Stockfish 19 (GNU General Public License v3)

`public/engine/stockfish-19-lite-single.js` and `.wasm` are Stockfish 19 compiled to WebAssembly by Stockfish.js v19.0.1 (Nathan Rugg and contributors), unmodified from the `stockfish` npm package. Stockfish is developed by the Stockfish authors.

- The license text is in `public/engine/COPYING.txt` and ships with the app.
- The complete corresponding source is at https://github.com/nmrugg/stockfish.js/tree/v19.0.1. Upstream: https://github.com/official-stockfish/Stockfish.
- File hashes are in `public/engine/SOURCE.txt`.

The app runs the engine as a separate program in a Web Worker and communicates with it only through the UCI text protocol.

## Capacitor and plugins (MIT license)

`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/haptics` (Copyright (c) Ionic) and `@capacitor-community/keep-awake` are distributed under the MIT license. The full texts are in each package's `LICENSE` file under `node_modules/`.

## Development only (not shipped)

`chess.js` (BSD-2-Clause) is used only as a test oracle in `tests/fuzz.test.ts`.

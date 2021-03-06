// const colors = [0xFF3DBAA2, 0xFF38AA92, 0xFF36603D, 0xFF14371B];
const colors = [0xFF0FBC9B, 0xFF0FAC8B, 0xFF306230, 0xFF0F380F, 0xFF9FDCCA];

function makePalette(byte) {
    return [byte & 0x03, byte >> 2 & 0x03, byte >> 4 & 0x03, byte >> 6];
}


class PPU {
    constructor(dmg) {
        this.dmg = dmg;
        this.mmu = dmg.mmu;
        this.isDisplayEnabled = false;
        this.enabled = true;
    }

    setContext(context) {
        this.screenContext = context;
        this.lineData = this.screenContext.createImageData(160, 1);
        this.lineArray = new Uint32Array(this.lineData.data.buffer);
    }

    drawLine(ly) {
        if (!this.enabled || !this.isDisplayEnabled) {
            return;
        }
        const y = (ly + this.mmu.memory[0xff42]) & 0xff;
        const tileY = y >> 3;
        const pixelY = y & 0x07;
        let x = this.mmu.memory[0xff43];
        let tileX = x >> 3;
        let pixelX = 7 - (x & 0x07);
        const tileMapOffset = (this.mmu.memory[0xff40] & 0x08 ? 0x9c00 : 0x9800) + tileY * 32;
        let tileIndex;
        let tileDataOffset;
        const palette = [
            this.mmu.memory[0xff47] & 0x03,
            (this.mmu.memory[0xff47] >> 2) & 0x03,
            (this.mmu.memory[0xff47] >> 4) & 0x03,
            this.mmu.memory[0xff47] >> 6,
        ];
        for (let i = 0; i < 160; i++) {
            tileIndex = this.mmu.memory[tileMapOffset + tileX];
            tileDataOffset = this.mmu.memory[0xff40] & 0x10 ? 0x8000 + tileIndex * 16 : 0x9000 + (tileIndex << 24 >> 24) * 16;
            let lineByte0 = this.mmu.memory[tileDataOffset + 2 * pixelY];
            let lineByte1 = this.mmu.memory[tileDataOffset + 2 * pixelY + 1];
            let pixelValue = palette[((lineByte0 >> pixelX) & 0x01) | (((lineByte1 >> pixelX) & 0x01) << 1)];
            this.lineArray[i] = colors[pixelValue];
            x += 1;
            x &= 0xff;
            tileX = x >> 3;
            pixelX = 7 - (x & 0x07);
        }
        this.screenContext.putImageData(this.lineData, 0, ly);
    }

    setDisplayEnabled(val) {
        if (val) {
            this.isDisplayEnabled = true;
        } else {
            this.isDisplayEnabled = false;
            this.screenContext.fillStyle = "#CADC9F";
            this.screenContext.fillRect(0, 0, 160, 144);
        }
    }

    fetchTileLine(tileOffset, lineIndex, buffer, bufferOffset, palette = [0, 1, 2, 3]) {
        const byte0 = this.mmu.memory[tileOffset + 2 * lineIndex];
        const byte1 = this.mmu.memory[tileOffset + 2 * lineIndex + 1];
        for (let i = 0; i < 8; i++) {
            const j = 7 - i;
            const shade = (byte0 & 1 << j | (byte1 & 1 << j) << 1) >> j;
            buffer[bufferOffset + i] = colors[palette[shade]];
        }
    }

    displayTiles() {
        const tilesCanvas = document.getElementById("tiles");
        const tilesContext = tilesCanvas.getContext('2d');
        const tilesData = tilesContext.createImageData(128, 192);
        const tilesArray = new Uint32Array(tilesData.data.buffer);
        for (let tileIndex = 0; tileIndex < 384; tileIndex++) {
            for (let lineIndex = 0; lineIndex < 8; lineIndex++) {
                this.fetchTileLine(
                    0x8000 + 16 * tileIndex,
                    lineIndex,
                    tilesArray,
                    (~~(tileIndex / 16) * 8 + lineIndex) * 128 + (tileIndex % 16) * 8
                );
            }
        }
        tilesContext.putImageData(tilesData, 0, 0);
    }

    displayBG() {
        const bgCanvas = document.getElementById("background");
        const bgContext = bgCanvas.getContext('2d');
        const bgData = bgContext.createImageData(256, 256);
        const bgArray = new Uint32Array(bgData.data.buffer);
        const tileMapOffset = this.mmu.memory[0xff40] & 0x08 ? 0x9c00 : 0x9800;
        const palette = makePalette(this.mmu.memory[0xff47]);
        let offset = 0;
        let tileOffset;
        for (let ty = 0; ty < 32; ty++) {
            for (let lineIndex = 0; lineIndex < 8; lineIndex++) {
                for (let tx = 0; tx < 32; tx++) {
                    const tileIndex = this.mmu.memory[tileMapOffset + 32 * ty + tx];
                    if (this.mmu.memory[0xff40] & 0x10) {
                        tileOffset = 0x8000 + 16 * tileIndex;
                    } else {
                        tileOffset = 0x9000 + 16 * (tileIndex << 24 >> 24);
                    }
                    this.fetchTileLine(
                        tileOffset,
                        lineIndex,
                        bgArray,
                        offset,
                        palette,
                    )
                    offset += 8;
                }
            }
        }
        bgContext.putImageData(bgData, 0, 0);
    }
}

export {
    PPU,
};
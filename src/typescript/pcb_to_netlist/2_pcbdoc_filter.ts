import fs from 'fs';

class Filter {
    private dropP = ["INDEXFORSAVE","PATTERN","NAMEON","COMMENTON","GROUPNUM","COUNT","UNIONINDEX","CHANNELOFFSET","SOURCEUNIQUEID","SOURCEHIERARCHICALPATH","SOURCEFOOTPRINTLIBRARY","SOURCECOMPONENTLIBRARY","FOOTPRINTDESCRIPTION","SOURCECOMPLIBIDENTIFIERKIND","SOURCECOMPLIBRARYIDENTIFIER","VAULTGUID","ITEMGUID","ITEMREVISIONGUID","POLYGONTYPE","POUROVER","REMOVEDEAD","HATCHSTYLE","USEOCTAGONS","SA","SHELVED","RESTORELAYER","REMOVEISLANDSBYAREA","REMOVENECKS","AREATHRESHOLD","POUROVERSTYLE","POURINDEX","IGNOREVIOLATIONS","SOLDERMASKEXPANSIONMODE","PASTEMASKEXPANSIONMODE","OVERRIDEWITHV6_6SHAPES","FONT","MIRROR","USETTFONTS","BOLD","ITALIC","INVERTED","FONTNAME","WIDESTRING","USEINVERTEDRECTANGLE","TTFINVERTEDTEXTJUSTIFY","TEXTKIND","BARCODEKIND","BARCODERENDERMODE","BARCODEINVERTED","BARCODEFONTNAME","BARCODESHOWTEXT","ADVANCESNAPPING","STARTANGLE","ENDANGLE","SWAPID_PAD","SWAPID_GATE","SWAPPEDPADNAME","CCSV","CPLV","CCWV","CENV","CAGV","CPEV","CSEV","CPCV","CPRV","CEN","GATEID","UNIQUEID","SELECTION","LOCKED","USERROUTED","POLYGONOUTLINE","JUMPERSVISIBLE","HOLECOUNT","BODYPROJECTION","BODYOPACITY3D","PADMODE","DRILLTYPE","HOLETYPE","PADJUMPERID","DAISYCHAIN"];
    
    private dropIdx = /^(PAD[XY]OFFSET\d+|.*_MRWIDTH.*|.*SHAPE.*|.*ROTATION.*|.*Y\d+|.*X\d+|.*COLOR.*|.*MODEL.*|.*COUNT.*|.*BODY.*|.*LAYER.*|.*3D.*|.*KIND.*|.*CHECKSUM.*|.*TEXTURE.*|.*CONTOUR.*|.*POLY.*|EA\d+|LOOKAT.*|ZOOMMULT|VIEWSIZE.*|GR0_.*|EGMULT|NEAROBJECTSET|FAROBJECTSET|DRILLSYMBOL.*|HASHKEY.*|HASHVALUE.*|FN#.*|TEARDROPPARAM_.*|SURFACEMICROSTRIP_.*|SYMMETRICSTRIPLINE_.*|BOARDINSIGHTVIEWCONFIGURATIONNAME)$/;
    
    private dropMil = /.*=[0-9.+-]+mil$/;

    public isDrop(k: string, v: string = ""): boolean {
        return this.dropP.some(p => k.startsWith(p)) || this.dropIdx.test(k) || this.dropMil.test(`${k}=${v}`);
    }
}

export function pcbdocFilter(inPath: string, outPath: string): void {
    if (!fs.existsSync(inPath)) return;
    const data = fs.readFileSync(inPath, 'utf8');
    const flt = new Filter();
    const res: string[] = [];
    
    for (const line of data.split(/\r?\n/)) {
        const parts = line.trim().split("|").filter(x => {
            if (!x.includes("=")) return false;
            const [k, v] = x.split("=", 2);
            return !flt.isDrop(k, v);
        });
        if (parts.length > 0) res.push(parts.join("|"));
    }
    
    fs.writeFileSync(outPath, res.join('\n'));
}

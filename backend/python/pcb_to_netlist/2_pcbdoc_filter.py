# file: 2_pcbdoc_filter.py
# Filter PCB: remove LAYER, mechanical and geometric fields

import sys # argv, exit
import re  # compile, match

class Filter:
    def __init__(self):
        self.drop_p = ("INDEXFORSAVE","PATTERN","NAMEON","COMMENTON","GROUPNUM","COUNT","UNIONINDEX","CHANNELOFFSET","SOURCEUNIQUEID","SOURCEHIERARCHICALPATH","SOURCEFOOTPRINTLIBRARY","SOURCECOMPONENTLIBRARY","FOOTPRINTDESCRIPTION","SOURCECOMPLIBIDENTIFIERKIND","SOURCECOMPLIBRARYIDENTIFIER","VAULTGUID","ITEMGUID","ITEMREVISIONGUID","POLYGONTYPE","POUROVER","REMOVEDEAD","HATCHSTYLE","USEOCTAGONS","SA","SHELVED","RESTORELAYER","REMOVEISLANDSBYAREA","REMOVENECKS","AREATHRESHOLD","POUROVERSTYLE","POURINDEX","IGNOREVIOLATIONS","SOLDERMASKEXPANSIONMODE","PASTEMASKEXPANSIONMODE","OVERRIDEWITHV6_6SHAPES","FONT","MIRROR","USETTFONTS","BOLD","ITALIC","INVERTED","FONTNAME","WIDESTRING","USEINVERTEDRECTANGLE","TTFINVERTEDTEXTJUSTIFY","TEXTKIND","BARCODEKIND","BARCODERENDERMODE","BARCODEINVERTED","BARCODEFONTNAME","BARCODESHOWTEXT","ADVANCESNAPPING","STARTANGLE","ENDANGLE","SWAPID_PAD","SWAPID_GATE","SWAPPEDPADNAME","CCSV","CPLV","CCWV","CENV","CAGV","CPEV","CSEV","CPCV","CPRV","CEN","GATEID","UNIQUEID","SELECTION","LOCKED","USERROUTED","POLYGONOUTLINE","JUMPERSVISIBLE","HOLECOUNT","BODYPROJECTION","BODYOPACITY3D","PADMODE","DRILLTYPE","HOLETYPE","PADJUMPERID","DAISYCHAIN")
        self.drop_idx = re.compile(r"(PAD[XY]OFFSET\d+|.*_MRWIDTH.*|.*SHAPE.*|.*ROTATION.*|.*Y\d+|.*X\d+|.*COLOR.*|.*MODEL.*|.*COUNT.*|.*BODY.*|.*LAYER.*|.*3D.*|.*KIND.*|.*CHECKSUM.*|.*TEXTURE.*|.*CONTOUR.*|.*POLY.*|EA\d+|LOOKAT.*|ZOOMMULT|VIEWSIZE.*|GR0_.*|EGMULT|NEAROBJECTSET|FAROBJECTSET|DRILLSYMBOL.*|HASHKEY.*|HASHVALUE.*|FN#.*|TEARDROPPARAM_.*|SURFACEMICROSTRIP_.*|SYMMETRICSTRIPLINE_.*|BOARDINSIGHTVIEWCONFIGURATIONNAME)$")
        self.drop_mil = re.compile(r".*=[0-9.+-]+mil$")
    def is_drop(self, k, v=""):
        return k.startswith(self.drop_p) or self.drop_idx.match(k) or self.drop_mil.match(f"{k}={v}")

def main():
    if len(sys.argv) < 3: sys.exit(1)
    with open(sys.argv[1], "r", encoding="cp1251", errors="replace") as f: data = f.read()
    flt = Filter()
    res = []
    for l in data.splitlines():
        p = [x for x in l.strip().split("|") if "=" in x and not flt.is_drop(*x.split("=", 1))]
        if p: res.append("|".join(p))
    with open(sys.argv[2], "w", encoding="utf-8") as f: f.write("\n".join(res))

if __name__ == "__main__":
    main()

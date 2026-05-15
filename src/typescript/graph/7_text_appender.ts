import fs from 'fs';
import Graph from 'graphology';
import { getBranch } from './4_get_branch';
import { graphToText } from './5_graph_to_text';
import { removeNets } from './6_remove_nets';

export function textAppender(gExport: any, pinListPath: string, commonNets: Set<string>, targetComponent: string, outputPath: string): void {
    const G = new Graph();
    G.import(gExport);

    if (!fs.existsSync(pinListPath)) return;
    const pinContent = fs.readFileSync(pinListPath, 'utf8');
    const pins = pinContent.match(new RegExp(`^${targetComponent}_\\w+`, 'gm')) || [];

    let appenderContent = "";
    for (const pin of pins) {
        const branch = getBranch(G, pin, commonNets);
        if (branch.order > 0) {
            let text = graphToText(branch, pin, commonNets);
            if (text !== "NOT_CONNECTED") {
                text = removeNets(text);
                appenderContent += `\n<<<${pin}>>> START\n${text}\n<<<${pin}>>> END\n`;
            }
        }
    }
    fs.writeFileSync(outputPath, appenderContent.trim());
}

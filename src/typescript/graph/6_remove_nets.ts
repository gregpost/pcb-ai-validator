export function removeNets(text: string): string {
    let result = text.replace(/Net\w+-/g, '')
                 .replace(/-Net\w+/g, '')
                 .replace(/Net\w+/g, '')
                 .replace(/-+/g, '-')
                 .replace(/\(\s*\)/g, '');
    return result;
}

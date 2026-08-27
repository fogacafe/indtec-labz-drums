import JSZip from 'jszip';

const XML_EXTENSIONS = ['.xml', '.musicxml'];

export async function readMusicXmlFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  if (XML_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return file.text();
  }

  if (!lowerName.endsWith('.mxl')) {
    throw new Error('Unsupported score format. Use .xml, .musicxml or .mxl.');
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerEntry = zip.file('META-INF/container.xml');

  if (!containerEntry) {
    throw new Error('Invalid MXL file: META-INF/container.xml was not found.');
  }

  const containerXml = await containerEntry.async('string');
  const containerDocument = new DOMParser().parseFromString(containerXml, 'application/xml');

  if (containerDocument.querySelector('parsererror')) {
    throw new Error('Invalid MXL container.xml.');
  }

  const rootFile = containerDocument.querySelector('rootfile')?.getAttribute('full-path');

  if (!rootFile) {
    throw new Error('Invalid MXL file: MusicXML rootfile was not declared.');
  }

  const scoreEntry = zip.file(rootFile);

  if (!scoreEntry) {
    throw new Error(`Invalid MXL file: ${rootFile} was not found.`);
  }

  return scoreEntry.async('string');
}

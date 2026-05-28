import { cleanSongText } from './src/utils/chordUtils';

const textWithTabs = `Bendice Alma mía al Señor
\t\t\t\t\tC
Bendiga mi corazón tu santo nombre`;

console.log(cleanSongText(textWithTabs));

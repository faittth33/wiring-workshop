import {readFile,writeFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const courses = JSON.parse(await readFile(new URL('courses.json', root), 'utf8'));
const css = await readFile(new URL('circuit-base.css', root), 'utf8');
for (const course of courses) course.fragment = await readFile(new URL('circuits/' + course.id + '.html', root), 'utf8');
await writeFile(new URL('circuits.js', root), 'window.CIRCUITS = ' + JSON.stringify(courses) + ';\nwindow.CIRCUIT_CSS = ' + JSON.stringify(css) + ';\n');
console.log('Built four circuits.');

const bidiFactory = require('bidi-js');
console.log("Keys:", Object.keys(bidiFactory));
try {
    const bidi = bidiFactory();
    console.log("bidi instance keys:", Object.keys(bidi));
    console.log("is getReorderedText a function?", typeof bidi.getReorderedText);
} catch (e) {
    console.log("Factory error:", e);
}

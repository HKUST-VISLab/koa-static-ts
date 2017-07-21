const shelljs = require("shelljs");

function cleanDist() {
    shelljs.rm("-rf", 'dist');
}

switch (process.argv[2]) {
    case "clean":
        cleanDist();
        break;
    default:
        console.info("No command");
}
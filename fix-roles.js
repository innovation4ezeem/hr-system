const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']) -> requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation'])
      if (content.includes("['employee', 'hod', 'admin', 'intern', 'probation']")) {
        content = content.replace(/\['employee', 'hod', 'admin', 'intern', 'probation'\]/g, "['employee', 'director', 'hod', 'admin', 'intern', 'probation']");
        changed = true;
      }
      
      // requireRole(request, ['employee', 'hod', 'admin']) -> requireRole(request, ['employee', 'director', 'hod', 'admin'])
      if (content.includes("['employee', 'hod', 'admin']")) {
        content = content.replace(/\['employee', 'hod', 'admin'\]/g, "['employee', 'director', 'hod', 'admin']");
        changed = true;
      }

      // requireRole(request, ['hod', 'admin']) -> requireRole(request, ['director', 'hod', 'admin'])
      if (content.includes("['hod', 'admin']")) {
        content = content.replace(/\['hod', 'admin'\]/g, "['director', 'hod', 'admin']");
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src', 'app', 'api'));

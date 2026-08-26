import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `      setTimeout(() => {
        window.focus();
        document.body?.focus();
      }, 350);
    }
  };`,
  `      setTimeout(() => {
        window.focus();
        document.body?.focus();
        window.dispatchEvent(new Event('resize'));
      }, 350);
    }
  };`
);

fs.writeFileSync('src/App.tsx', content);

const fs = require('fs');
let c = fs.readFileSync('src/components/players/PlayerProfile.tsx', 'utf8');

// Find the monthly stats section and replace
const idx = c.indexOf("          const now = new Date();\n          const monthName = now.toLocaleString");
if (idx < 0) { console.log('Not found'); process.exit(1); }

// Find end of the variable declarations block (up to 'return (')
const retIdx = c.indexOf('          return (\n            <div style={{\n              background: \'linear-gradient(135deg, #001a2a', idx);
if (retIdx < 0) { console.log('Return not found'); process.exit(1); }

const oldBlock = c.substring(idx, retIdx);
console.log('Old block length:', oldBlock.length);
console.log('First 100:', oldBlock.substring(0,100));

const newBlock = `          const now = new Date();
          const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
          // Show most recent active month
          const doneM = matches.filter(m => m.completed_at);
          let activeMonth = thisMonth;
          if (doneM.length > 0 && !doneM.some(m => m.completed_at!.startsWith(thisMonth))) {
            const sorted = doneM.map(m => m.completed_at!.substring(0,7)).sort().reverse();
            activeMonth = sorted[0];
          }
          const activeDate = new Date(activeMonth + '-01');
          const monthName = activeDate.toLocaleString('en', { month: 'long', year: 'numeric' });
          const isCurrentMonth = activeMonth === thisMonth;
          const monthMatches = matches.filter(m => m.completed_at && m.completed_at.startsWith(activeMonth));
          const mWon = monthMatches.filter(m => {
            const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;
            return onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
          }).length;
          const mDrawn = monthMatches.filter(m => !m.winner_id).length;
          const mLost = monthMatches.length - mWon - mDrawn;
          const mWinRate = monthMatches.length > 0 ? Math.round((mWon / monthMatches.length) * 100) : 0;
`;

c = c.substring(0, idx) + newBlock + c.substring(retIdx);

// Fix the header label
c = c.replace(
  "                    This Month\n                  </div>",
  "                    {isCurrentMonth ? 'This Month' : 'Last Active · ' + monthName}\n                  </div>"
);

fs.writeFileSync('src/components/players/PlayerProfile.tsx', c);
console.log('Monthly stats fixed!');

const fs = require('fs');
let c = fs.readFileSync('src/components/players/PlayerProfile.tsx', 'utf8');

// Fix monthly stats to use last active month
const old1 = "          const now = new Date();\n          const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' });\n          const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;\n\n          const monthMatches = matches.filter(m =>\n            m.completed_at && m.completed_at.startsWith(thisMonth)\n          );\n          const mWon = monthMatches.filter(m => {\n            const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;\n            return onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;\n          }).length;\n          const mDrawn = monthMatches.filter(m => m.completed_at && !m.winner_id).length;\n          const mLost = monthMatches.length - mWon - mDrawn;\n\n          const mWinRate = monthMatches.length > 0 ? Math.round((mWon / monthMatches.length) * 100) : 0;";

const new1 = "          const now = new Date();\n          const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;\n          // Use most recent month with matches\n          const doneMatches = matches.filter(m => m.completed_at);\n          let activeMonth = thisMonth;\n          if (doneMatches.length > 0) {\n            const allMonths = doneMatches.map(m => m.completed_at!.substring(0,7)).sort().reverse();\n            if (!doneMatches.some(m => m.completed_at!.startsWith(thisMonth))) {\n              activeMonth = allMonths[0];\n            }\n          }\n          const activeDate = new Date(activeMonth + '-01');\n          const monthName = activeDate.toLocaleString('en', { month: 'long', year: 'numeric' });\n          const isCurrentMonth = activeMonth === thisMonth;\n          const monthMatches = matches.filter(m => m.completed_at && m.completed_at.startsWith(activeMonth));\n          const mWon = monthMatches.filter(m => {\n            const onTeam1 = m.player1_id === playerId || m.team1_player2_id === playerId;\n            return onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;\n          }).length;\n          const mDrawn = monthMatches.filter(m => !m.winner_id).length;\n          const mLost = monthMatches.length - mWon - mDrawn;\n          const mWinRate = monthMatches.length > 0 ? Math.round((mWon / monthMatches.length) * 100) : 0;";

if (c.includes(old1)) {
  c = c.replace(old1, new1);
  console.log('Monthly stats fixed');
} else {
  console.log('Monthly pattern not found');
}

// Fix header label
c = c.replace(
  "                    This Month\n                  </div>",
  "                    {isCurrentMonth ? 'This Month' : 'Last Active · ' + monthName}\n                  </div>"
);

fs.writeFileSync('src/components/players/PlayerProfile.tsx', c);
console.log('Done');

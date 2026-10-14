// The 5 rules from the project notes.
//   text     the full rule;  short: a short version for boards, tooltips and the report
//   penalty  what the game does when you break it;  buttons: the buttons it talks about
export const RULES = [
  {n:1, text:"Don't press the MAD MAX button if you don't have TURBO on the car.", short:'No MAD MAX without TURBO',              penalty:'The engine stalls for 3 seconds.',            buttons:['madmax', 'turbo']},
  {n:2, text:"Don't press the JUMP button if you score a goal.",                   short:"Don't JUMP after you score",           penalty:'Your goal is cancelled.',                     buttons:['jump']},
  {n:3, text:"Don't double-click on the RADIO.",                                   short:"Don't double-click on the RADIO",      penalty:'The radio breaks: no music for 10 seconds.',  buttons:['radio']},
  {n:4, text:"Don't spam the JUMP button, because you can explode.",              short:"Don't spam JUMP",                      penalty:'4 jumps in 1.5 seconds and your car explodes.', buttons:['jump']},
  {n:5, text:"Don't use the 4X4 mode if you haven't used the TUNING button.",     short:'Use TUNING before 4X4',                penalty:'Your wheels get stuck for 2 seconds.',        buttons:['4x4', 'tuning']}
];

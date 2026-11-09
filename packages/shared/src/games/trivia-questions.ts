/** Original Halloween quiz content written for Ghostel. `wrong` holds exactly three distractors. */
export interface TriviaSource {
  text: string;
  correct: string;
  wrong: readonly [string, string, string];
}

export const TRIVIA_QUESTIONS: readonly TriviaSource[] = [
  { text: "Halloween grew out of which ancient Celtic festival?", correct: "Samhain", wrong: ["Beltane", "Yule", "Imbolc"] },
  { text: "Before pumpkins, what did people in Ireland carve into lanterns?", correct: "Turnips", wrong: ["Potatoes", "Carrots", "Apples"] },
  { text: "The word “Halloween” is a contraction of…", correct: "All Hallows' Eve", wrong: ["Hollow Evening", "Hallowed Woods", "Holy Wine Night"] },
  { text: "Who wrote the novel “Frankenstein”?", correct: "Mary Shelley", wrong: ["Bram Stoker", "Edgar Allan Poe", "H. P. Lovecraft"] },
  { text: "Who wrote the 1897 novel “Dracula”?", correct: "Bram Stoker", wrong: ["Mary Shelley", "Oscar Wilde", "Robert Louis Stevenson"] },
  { text: "In which region is Count Dracula's castle?", correct: "Transylvania", wrong: ["Bavaria", "Normandy", "Tuscany"] },
  { text: "Which kitchen plant is said to keep vampires away?", correct: "Garlic", wrong: ["Basil", "Mint", "Rosemary"] },
  { text: "Which bird keeps saying “Nevermore” in Edgar Allan Poe's famous poem?", correct: "A raven", wrong: ["A crow", "An owl", "A magpie"] },
  { text: "Who wrote “The Legend of Sleepy Hollow”?", correct: "Washington Irving", wrong: ["Nathaniel Hawthorne", "Mark Twain", "Edgar Allan Poe"] },
  { text: "In “The Legend of Sleepy Hollow”, what is found smashed after the Headless Horseman's chase?", correct: "A pumpkin", wrong: ["A skull", "A lantern", "A pocket watch"] },
  { text: "What is a fear of Halloween called?", correct: "Samhainophobia", wrong: ["Arachnophobia", "Coulrophobia", "Nyctophobia"] },
  { text: "Famous escape artist Harry Houdini died on which day?", correct: "Halloween", wrong: ["Christmas Eve", "New Year's Day", "Valentine's Day"] },
  { text: "A group of crows is called a…", correct: "Murder", wrong: ["Parliament", "Pride", "Gaggle"] },
  { text: "A group of owls is called a…", correct: "Parliament", wrong: ["Murder", "Colony", "Pod"] },
  { text: "What do vampire bats feed on?", correct: "Blood", wrong: ["Fruit", "Nectar", "Fish"] },
  { text: "Bats are the only mammals that can…", correct: "Truly fly", wrong: ["Echolocate", "Hibernate", "See in the dark"] },
  { text: "How many legs does a spider have?", correct: "Eight", wrong: ["Six", "Ten", "Twelve"] },
  { text: "Botanically speaking, a pumpkin is a kind of…", correct: "Berry", wrong: ["Root", "Nut", "Legume"] },
  { text: "Roughly how much of a pumpkin is water?", correct: "About 90%", wrong: ["About 25%", "About 50%", "About 70%"] },
  { text: "Día de los Muertos is a tradition that comes from which country?", correct: "Mexico", wrong: ["Spain", "Brazil", "Peru"] },
  { text: "The 1692 witch trials took place in Salem, in which present-day US state?", correct: "Massachusetts", wrong: ["Virginia", "New York", "Pennsylvania"] },
  { text: "In folklore, what turns a person into a werewolf?", correct: "A full moon", wrong: ["A new moon", "A solar eclipse", "A thunderstorm"] },
  { text: "Which Egyptian god of mummification has the head of a jackal?", correct: "Anubis", wrong: ["Horus", "Ra", "Thoth"] },
  { text: "Ancient Egyptians stored a mummy's organs in…", correct: "Canopic jars", wrong: ["Amphorae", "Clay ovens", "Golden boxes"] },
  { text: "John Carpenter's horror film “Halloween” came out in which year?", correct: "1978", wrong: ["1974", "1980", "1984"] },
  { text: "What is the name of the masked killer in “Halloween”?", correct: "Michael Myers", wrong: ["Jason Voorhees", "Freddy Krueger", "Ghostface"] },
  { text: "Which singer starred in the zombie-filled “Thriller” music video?", correct: "Michael Jackson", wrong: ["Prince", "Madonna", "David Bowie"] },
  { text: "In “Ghostbusters” (1984), what colour is the ghost Slimer?", correct: "Green", wrong: ["Blue", "Purple", "Orange"] },
  { text: "Which 1982 film has the famous line “They're here!”?", correct: "Poltergeist", wrong: ["The Exorcist", "The Shining", "Carrie"] },
  { text: "In “The Nightmare Before Christmas”, who is the Pumpkin King?", correct: "Jack Skellington", wrong: ["Oogie Boogie", "Sally", "Lock"] },
  { text: "What is the name of Jack Skellington's ghost dog?", correct: "Zero", wrong: ["Scraps", "Sparky", "Bones"] },
  { text: "What is the family name of the three witch sisters in “Hocus Pocus”?", correct: "Sanderson", wrong: ["Halliwell", "Owens", "Spellman"] },
  { text: "In “The Addams Family”, what is the name of the helpful disembodied hand?", correct: "Thing", wrong: ["Lurch", "Itt", "Pugsley"] },
  { text: "Which 1940 Disney film features “Night on Bald Mountain”?", correct: "Fantasia", wrong: ["Pinocchio", "Dumbo", "Bambi"] },
  { text: "In Poe's “The Tell-Tale Heart”, what sound drives the narrator mad?", correct: "A beating heart", wrong: ["A ticking clock", "A dripping tap", "A creaking door"] },
  { text: "Casper is best known as a friendly…", correct: "Ghost", wrong: ["Vampire", "Zombie", "Werewolf"] },
];

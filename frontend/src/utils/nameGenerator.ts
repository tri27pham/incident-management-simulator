const animals = [
  'Panda', 'Dolphin', 'Tiger', 'Koala', 'Elephant',
  'Giraffe', 'Penguin', 'Octopus', 'Leopard', 'Fox',
  'Wolf', 'Owl', 'Eagle', 'Lion', 'Bear',
  'Whale', 'Shark', 'Otter', 'Raccoon', 'Squirrel',
  'Rabbit', 'Deer', 'Moose', 'Bison', 'Zebra',
  'Rhino', 'Hippo', 'Gorilla', 'Chimpanzee', 'Orangutan',
  'Sloth', 'Armadillo', 'Hedgehog', 'Platypus', 'Kangaroo',
  'Flamingo', 'Peacock', 'Toucan', 'Parrot', 'Hummingbird',
  'Butterfly', 'Dragonfly', 'Ladybug', 'Bee', 'Ant',
  'Turtle', 'Tortoise', 'Chameleon', 'Gecko', 'Iguana',
];

export function generateAnonymousName(): string {
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `Anonymous ${animal}`;
}

export function getUserName(): string {
  // Check localStorage first
  let userName = localStorage.getItem('anonymousName');
  
  if (!userName) {
    // Generate new name and store it
    userName = generateAnonymousName();
    localStorage.setItem('anonymousName', userName);
  }
  
  return userName;
}

export function clearUserName(): void {
  localStorage.removeItem('anonymousName');
}


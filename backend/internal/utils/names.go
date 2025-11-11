package utils

import (
	"fmt"
	"math/rand"
	"time"
)

type Animal struct {
	Name  string
	Emoji string
}

var animals = []Animal{
	{"Panda", "🐼"}, {"Dolphin", "🐬"}, {"Tiger", "🐯"}, {"Koala", "🐨"}, {"Elephant", "🐘"},
	{"Giraffe", "🦒"}, {"Penguin", "🐧"}, {"Octopus", "🐙"}, {"Leopard", "🐆"}, {"Fox", "🦊"},
	{"Wolf", "🐺"}, {"Owl", "🦉"}, {"Eagle", "🦅"}, {"Lion", "🦁"}, {"Bear", "🐻"},
	{"Whale", "🐋"}, {"Shark", "🦈"}, {"Otter", "🦦"}, {"Raccoon", "🦝"}, {"Squirrel", "🐿️"},
	{"Rabbit", "🐰"}, {"Deer", "🦌"}, {"Moose", "🫎"}, {"Bison", "🦬"}, {"Zebra", "🦓"},
	{"Rhino", "🦏"}, {"Hippo", "🦛"}, {"Gorilla", "🦍"}, {"Chimpanzee", "🐵"}, {"Orangutan", "🦧"},
	{"Sloth", "🦥"}, {"Armadillo", "🦡"}, {"Hedgehog", "🦔"}, {"Platypus", "🦫"}, {"Kangaroo", "🦘"},
	{"Flamingo", "🦩"}, {"Peacock", "🦚"}, {"Toucan", "🐦"}, {"Parrot", "🦜"}, {"Hummingbird", "🐦"},
	{"Butterfly", "🦋"}, {"Dragonfly", "🐝"}, {"Ladybug", "🐞"}, {"Bee", "🐝"}, {"Ant", "🐜"},
	{"Turtle", "🐢"}, {"Tortoise", "🐢"}, {"Chameleon", "🦎"}, {"Gecko", "🦎"}, {"Iguana", "🦎"},
	{"Monkey", "🐒"}, {"Frog", "🐸"}, {"Cat", "🐱"}, {"Dog", "🐶"}, {"Pig", "🐷"},
	{"Chicken", "🐔"}, {"Duck", "🦆"}, {"Swan", "🦢"}, {"Seal", "🦭"}, {"Walrus", "🦭"},
}

var colors = []string{
	"#EF4444", "#F59E0B", "#10B981", "#3B82F6",
	"#6366F1", "#8B5CF6", "#EC4899", "#14B8A6",
	"#F97316", "#84CC16", "#06B6D4", "#A855F7",
	"#F43F5E", "#22C55E", "#0EA5E9", "#D946EF",
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

// GenerateAnonymousName generates a random "Anonymous Animal" name
func GenerateAnonymousName() string {
	animal := animals[rand.Intn(len(animals))]
	return fmt.Sprintf("Anonymous %s", animal.Name)
}

// GenerateRandomAnimal returns a random animal with emoji
func GenerateRandomAnimal() Animal {
	return animals[rand.Intn(len(animals))]
}

// GenerateRandomColor generates a random color for user avatar
func GenerateRandomColor() string {
	return colors[rand.Intn(len(colors))]
}


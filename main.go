package main

import (
	"fmt"

	"github.com/sv-tools/gstack"
)

func main() {
	s := gstack.New(1, 2, 3, 4)
	fmt.Println("Len:", s.Len())
	fmt.Println("Pop:", s.Pop())
	s.Push(5)
	fmt.Println("Peek:", s.Peek())
	fmt.Println("IsEmpty:", s.IsEmpty())
}

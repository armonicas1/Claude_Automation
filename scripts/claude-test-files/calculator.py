#!/usr/bin/env python3
"""
Sample Python file for Claude Code testing
Contains basic mathematical functions and a class
"""

def calculate_factorial(n):
    """Calculate factorial of n using recursion"""
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

class Calculator:
    """Simple calculator class"""
    
    def __init__(self):
        self.history = []
    
    def add(self, a, b):
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def multiply(self, a, b):
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result
    
    def get_history(self):
        return self.history

if __name__ == "__main__":
    calc = Calculator()
    print(calc.add(5, 3))
    print(calc.multiply(4, 6))
    print("History:", calc.get_history())

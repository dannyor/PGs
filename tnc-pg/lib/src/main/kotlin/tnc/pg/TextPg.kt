package tnc.pg

class TextPg {

}

fun main() {
    val s = "ת"
    val c = s[0]
    println(isHebrewLetter(c+1))
}

fun isHebrewLetter(c: Char): Boolean {
    return c in '\u05d0'..'\u05ea'
}

fun isHebrewPunctuation(c: Char): Boolean {
    return c in '\u05b0'..'\u05bf'
}
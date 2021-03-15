package tnc.pg

import kotlinx.serialization.Serializable

@Serializable
data class Bible(val books:List<Book>)

@Serializable
data class Book(val name: String, val numOfChapters: Int, val numOfVerses: Int) {
    val chapters = mutableListOf<Chapter>()
}

@Serializable
data class Chapter(val chapterIndex:Int, val numOfVerses: Int) {
    val verses = mutableListOf<String>()
}
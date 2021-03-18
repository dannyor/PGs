package tnc.pg

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.apache.commons.io.FileUtils
import java.io.File

fun parseFrom(f: File) : Bible {
    val fileContents:String = FileUtils.readFileToString(f, "UTF-16")
    val bible = Json { prettyPrint = true }.decodeFromString<Bible>(fileContents)
    return bible
}

fun main() {
    val b = parseFrom(File("C:/x/projects/PGs/tnc-pg/result-resources/flat/bible.json"))
    val book = b.books[3]
//    println(book.name)

//    book.chapters[9].verses.forEach {println(it)}
    val last = book.chapters[9].verses.last()
    last.forEach {
        println("$it    ${it.toInt().toString(16)}")
    }
    println(book.chapters[9].verses.last().last().toInt().toString(16))
}
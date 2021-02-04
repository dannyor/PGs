package tnc.pg

import net.java.truevfs.access.TFile
import net.java.truevfs.access.TFileReader
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.BufferedReader
import java.util.regex.Pattern
import java.lang.IllegalStateException
import java.nio.charset.Charset


data class Book(val name: String, val numOfChapters: Int, val numOfVerses: Int) {
    val chapters = mutableListOf<Chapter>()
}
data class Chapter(val chapterIndex:Int, val numOfVerses: Int) {
    val verses = mutableListOf<String>()
}

private val commentPrefix = "\u202axxxx"
private val linePrefix = "\u05D2\u20AC\u00D7xxxx"

class WestminsterFormatBookParser(
    private val file: TFile) : AutoCloseable {
    val logger: Logger = LoggerFactory.getLogger(javaClass)
    private val reader = BufferedReader(TFileReader(file, Charset.forName("UTF8")))
    var currentLine: String = ""
    var isCommentLine: Boolean = false
    var isEnd: Boolean = false
    var book = Book("", -1, -1)
    var currentChapter = Chapter(-1, -1)

    val bookPattern = Pattern.compile("(.+?) \\((.+?) chapters, (.+?) verses\\)")
    val chapterPattern = Pattern.compile("Chapter (\\d+)   \\((\\d+) verses\\)")
    val versePattern = Pattern.compile("\u202b  (\\d+):(\\d+)   (.+?)")


    fun parse() {
        nextLine()
        book = processBookHeader()
        nextLine()
        while (!isEnd) {
            processChapterHeader()
            nextLine()
            processChapterContents()
        }
    }

    private fun nextLine() {
        currentLine = reader.readLine().trim()
        isCommentLine = currentLine.startsWith(commentPrefix)
        isEnd = currentLine.contains("End of")
        if(isCommentLine) {
            currentLine = currentLine.substring(commentPrefix.length, currentLine.length).trim()
        } else {
            currentLine = currentLine.trim()
        }
        println("::: $currentLine")
    }

    private fun processBookHeader() : Book {
        while(isCommentLine) {
            if(currentLine.contains("chapters") && currentLine.contains("verses")) {
                val matcher = bookPattern.matcher(currentLine)
                matcher.find()
                val nChapters = Integer.parseInt(matcher.group(2))
                val nVerses = Integer.parseInt(matcher.group(3))
                return Book(matcher.group(1), nChapters, nVerses)
            }
            nextLine()
        }
        throw IllegalStateException()
    }

    private fun processChapterHeader() {
        nextLine()
        val matcher = chapterPattern.matcher(currentLine)
        matcher.find()
        val chapterIndex = Integer.parseInt(matcher.group(1))
        val nVerses = Integer.parseInt(matcher.group(2))
        currentChapter = Chapter(chapterIndex, nVerses)
        book.chapters.add(currentChapter)
        nextLine()
    }

    private fun processChapterContents() {
        while (!isCommentLine) {
            val matcher = bookPattern.matcher(currentLine)
            matcher.find()
            currentLine = matcher.group(3)
            currentChapter.verses.add(currentLine)
            nextLine()
        }
    }

    override fun close() {
        reader.close()
    }

}
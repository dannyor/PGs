package tnc.pg

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.java.truevfs.access.TFile
import org.apache.commons.io.FileUtils
import java.io.File

class Conversions(val targetDir: File) {
    fun convert(input: File) {
        val target = File(targetDir, input.parentFile.name + ".bib")
        if (target.exists()) {
            println("skipping: $target")
            return
        }
        convertTo(input, target)
    }

    fun convertTo(input: File, output: File) {
        val parser = WestminsterFormatBookParser(TFile(input))
        parser.parse()
        val encodedString = Json { prettyPrint = true }.encodeToString(parser.book)
        FileUtils.write(output, encodedString, "UTF-16")
    }
}

class SingleFileConversions(val targetDir: File) {
    private val bookList = mutableListOf<Book>()

    fun convert(input: File) {
        val parser = WestminsterFormatBookParser(TFile(input))
        parser.parse()
        bookList.add(parser.book)
    }

    fun writeToFile() {
        val bb = Bible(bookList)
        val encodedString = Json { prettyPrint = true }.encodeToString(bb)
        FileUtils.write(File(targetDir, "bible.json"), encodedString, "UTF-16")
    }
}

fun main() {
    flatFileConversion()
//    Conversions.convert(File("lib/src/main/resources/01.Tora-תורה/01.Bereshit-בראשית/consonants.txt"), File("Bereshit.bib"))
//    conversions.convertTo(File("lib/src/main/resources/02.Neviim-נביאים/16.Yoel-יואל/consonants.txt"), File("Yoel.bib"))
}

fun multiFilesConversion() {
    val conversions = Conversions(File("result-resources/multifiles-beautified"))
    File("lib/src/main/resources").walkTopDown().forEach {
        if (it.name.contains("consonants"))
            conversions.convert(it)
    }
}

fun flatFileConversion() {
    val conversions = SingleFileConversions(File("result-resources/multifiles-beautified"))
    File("lib/src/main/resources").walkTopDown().forEach {
        if (it.name.contains("consonants"))
            conversions.convert(it)
    }
    conversions.writeToFile()
}
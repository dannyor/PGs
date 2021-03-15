package tnc.pg

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.java.truevfs.access.TFile
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

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
//        val encodedString = Json.encodeToString(parser.book)
        val writer = BufferedWriter(FileWriter(output))
        writer.write(encodedString)
    }
}

fun main() {
    val conversions = Conversions(File("result-resources/multifiles-beautified"))
    File("lib/src/main/resources").walkTopDown().forEach {
        if (it.name.contains("consonants"))
            conversions.convert(it)
    }
//    Conversions.convert(File("lib/src/main/resources/01.Tora-תורה/01.Bereshit-בראשית/consonants.txt"), File("Bereshit.bib"))
}
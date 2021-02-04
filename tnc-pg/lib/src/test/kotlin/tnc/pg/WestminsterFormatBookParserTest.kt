package tnc.pg

import net.java.truevfs.access.TFile
import org.junit.Before

import org.junit.Assert.*
import org.junit.Test

class WestminsterFormatBookParserTest {

    @Before
    fun setUp() {
    }

    @Test
    fun ddd() {
        val parser = WestminsterFormatBookParser(TFile("src/main/resources/01.Tora-תורה/01.Bereshit-בראשית/consonants.txt"))
        parser.parse()
    }
}
package tnc.pg.io.resource

import java.io.InputStream

interface Resource {
    fun getName() : String
    fun openStream() : InputStream
}

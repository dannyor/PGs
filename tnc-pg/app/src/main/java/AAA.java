import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;

public class AAA {
    public static void main(String[] args) throws IOException {
        String foo = FileUtils.readFileToString(new File("C:/x/hm.txt"), "UTF-8");
        for (int i = 0; i < foo.length(); i++)
            System.out.println( "\\u" + Integer.toHexString(foo.charAt(i) | 0x10000).substring(1)+"  "+foo.charAt(i));
    }
}

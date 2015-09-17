package sketchpad;

import java.util.BitSet;
import java.util.stream.IntStream;

import org.apache.commons.lang.ArrayUtils;

public class BitSetP {

	public static void main(String[] args) {
		BitSet bs = new BitSet();
		bs.set(3);
		bs.set(5);
		IntStream stream = bs.stream();
//		stream.
//		System.out.println(ArrayUtils.toString(longArray));
		System.out.println(bs.get(1));
		System.out.println(bs.get(10));
	}

}

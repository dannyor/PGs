package altair.pg;

import java.io.File;

import altair.o2p.database.skeleton.asip.AsipSkeletonXml;
import altair.o2p.database.skeleton.asip.IAsip;

public class AcmlLoadPg {

	public void load() {
		String uideLocation = System.getenv("UIDE");
		String asipXml = "altair.simulator/src/altair/simulator/iss/asip/testFiles/minimal_asip.xml";
		IAsip skeleton = AsipSkeletonXml.create(new File(uideLocation + "/" + asipXml));
		System.out.println("done");
		
	}
	
	public static void main(String[] args) {
		new AcmlLoadPg().load();
	}
}
